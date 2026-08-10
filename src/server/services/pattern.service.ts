import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import { normalizePatternCode } from "@/lib/utils/pattern-code";

export interface PatternCreateInput {
  // Already normalized (trim + uppercase) by the caller.
  patternCode: string;
  description: string;
  imageUrl: string | null;
  // The single required Module (.mdl) file. Url and Name are set together.
  moduleFileUrl: string;
  moduleFileName: string;
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
   * Creates a pattern with the pattern maker's own Pattern ID. Uniqueness is
   * enforced by the database's @@unique([businessId, patternCode]) — a P2002
   * here means that ID is already taken, which (unlike the old auto-generated
   * scheme) is a real user error to surface, not something to retry.
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
      if (isDuplicate) throw new ConflictError(`Pattern ID "${input.patternCode}" is already taken. Choose a different one.`);
      throw e;
    }
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
      const pattern = await prisma.pattern.findFirst({ where: { id: patternId, businessId }, select: { patternCode: true } });
      if (!pattern) throw new NotFoundError("Pattern");
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
