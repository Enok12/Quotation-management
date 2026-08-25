import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError, ForbiddenError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import { normalizePatternCode } from "@/lib/utils/pattern-code";

export interface PatternCreateInput {
  // Already normalized (from the file name) by the caller.
  patternCode: string;
  // The required Module (.mdl) file. A pattern maker uploads only this; the
  // pattern starts PENDING_REVIEW with no description/picture until an admin
  // finalizes it (see finalize()).
  moduleFileUrl: string;
  moduleFileName: string;
}

export interface PatternFinalizeInput {
  description: string;
  /** A newly uploaded picture URL. Omitted = keep whatever's there. */
  imageUrl?: string;
}

export interface PatternFile {
  label: string; // "Module"
  url: string;
  name: string;
}

// The pattern's downloadable file(s) — currently just the single Module file,
// returned as an array (empty if an older pattern has none) so every read path
// (list page, list API, assign-dialog lookup) renders it the same way.
export function patternFiles(p: {
  moduleFileUrl: string | null;
  moduleFileName: string | null;
}): PatternFile[] {
  return p.moduleFileUrl
    ? [{ label: "Module", url: p.moduleFileUrl, name: p.moduleFileName ?? "Module" }]
    : [];
}

export const patternService = {
  /**
   * Creates a PENDING_REVIEW pattern from a bulk-uploaded module file. The
   * Pattern ID is derived from the file name by the caller. Uniqueness is
   * enforced by the DB's @@unique([businessId, patternCode]) — a P2002 here
   * means that name is already used, which the upload flow reports as a
   * "skipped — already exists" for that one file (the rest still upload).
   */
  async create(input: PatternCreateInput, actorId: string, businessId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.pattern.create({
          data: { ...input, businessId, createdById: actorId },
        });
        await auditService.log(tx, {
          businessId, actorId, action: "PATTERN_CREATED", entityType: "Pattern", entityId: created.id,
          metadata: { patternCode: input.patternCode },
        });
        return created;
      });
    } catch (e) {
      const isDuplicate =
        typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
      if (isDuplicate) throw new ConflictError(`Pattern ID "${input.patternCode}" already exists.`);
      throw e;
    }
  },

  /**
   * Admin review: attach a description (+ optional picture) and mark the
   * pattern FINALIZED so it can be assigned. Also serves edits of an
   * already-finalized pattern (stays FINALIZED). Business-scoped.
   */
  async finalize(patternId: string, input: PatternFinalizeInput, actorId: string, businessId: string) {
    const pattern = await prisma.pattern.findFirst({ where: { id: patternId, businessId }, select: { id: true } });
    if (!pattern) throw new NotFoundError("Pattern");

    return prisma.$transaction(async (tx) => {
      const updated = await tx.pattern.update({
        where: { id: patternId },
        data: {
          description: input.description,
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          status: "FINALIZED",
          finalizedById: actorId,
          finalizedAt: new Date(),
        },
      });
      await auditService.log(tx, {
        businessId, actorId, action: "PATTERN_FINALIZED", entityType: "Pattern", entityId: patternId,
        metadata: { patternCode: updated.patternCode },
      });
      return updated;
    });
  },

  /**
   * Delete a pattern. A Pattern Maker may delete only their OWN, still
   * PENDING_REVIEW upload (e.g. a wrong file); an Admin may delete any.
   * Returns the deleted file URLs so the caller can clean up Blob storage.
   * (ReceiptItem.patternId is onDelete: SetNull, so any assigned items are
   * simply unassigned — order items are never destroyed.)
   */
  async remove(patternId: string, actorId: string, businessId: string, role: Role) {
    const pattern = await prisma.pattern.findFirst({
      where: { id: patternId, businessId },
      select: { id: true, createdById: true, status: true, patternCode: true, moduleFileUrl: true, imageUrl: true },
    });
    if (!pattern) throw new NotFoundError("Pattern");

    if (role !== "ADMIN") {
      const ownPending = pattern.createdById === actorId && pattern.status === "PENDING_REVIEW";
      if (!ownPending) throw new ForbiddenError("You can only delete your own patterns that are still pending review.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.pattern.delete({ where: { id: patternId } });
      await auditService.log(tx, {
        businessId, actorId, action: "PATTERN_DELETED", entityType: "Pattern", entityId: patternId,
        metadata: { patternCode: pattern.patternCode },
      });
    });
    return { moduleFileUrl: pattern.moduleFileUrl, imageUrl: pattern.imageUrl };
  },

  /**
   * Patterns visible to this user. A Pattern Maker only ever sees their own
   * uploads; an Admin (or Staff) sees everything in the business — otherwise
   * they couldn't review what contractors have submitted.
   */
  list(businessId: string, opts: { onlyCreatedById?: string } = {}) {
    return prisma.pattern.findMany({
      where: {
        businessId,
        ...(opts.onlyCreatedById ? { createdById: opts.onlyCreatedById } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    });
  },

  /**
   * Look up one pattern by its human code, for the Assign Pattern dialog.
   * Deliberately NOT filtered by creator: an admin assigning a pattern must
   * be able to find one uploaded by any pattern maker. Always scoped to the
   * business, so one tenant can never resolve another's code.
   */
  async findByCode(code: string, businessId: string) {
    const patternCode = normalizePatternCode(code);
    if (!patternCode) return null;
    return prisma.pattern.findFirst({
      where: { businessId, patternCode },
      include: { createdBy: { select: { name: true, email: true } } },
    });
  },

  /**
   * Assign a pattern to one order item (or clear it with patternId: null).
   * Both the item and the pattern are re-checked against the caller's
   * business, so an id from another tenant resolves to a clean 404 rather
   * than a cross-tenant write.
   */
  async assignToItem(itemId: string, patternId: string | null, actorId: string, businessId: string) {
    const item = await prisma.receiptItem.findFirst({
      where: { id: itemId, receipt: { businessId } },
      select: { id: true, description: true, receiptId: true },
    });
    if (!item) throw new NotFoundError("Order item");

    let patternCode: string | null = null;
    if (patternId !== null) {
      const pattern = await prisma.pattern.findFirst({ where: { id: patternId, businessId }, select: { patternCode: true, status: true } });
      if (!pattern) throw new NotFoundError("Pattern");
      // Defense-in-depth: a pending pattern must not be assignable even if its
      // id is obtained some other way (the lookup already hides pending ones).
      if (pattern.status !== "FINALIZED") throw new ConflictError("This pattern is still pending review and can't be assigned yet.");
      patternCode = pattern.patternCode;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.receiptItem.update({ where: { id: itemId }, data: { patternId } });
      await auditService.log(tx, {
        businessId, actorId,
        action: patternId ? "PATTERN_ASSIGNED" : "PATTERN_UNASSIGNED",
        entityType: "ReceiptItem", entityId: itemId,
        metadata: { receiptId: item.receiptId, item: item.description, patternCode },
      });
      return updated;
    });
  },
};
