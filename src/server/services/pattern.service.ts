import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import { generatePatternCode, normalizePatternCode } from "@/lib/utils/pattern-code";

export interface PatternCreateInput {
  description: string;
  imageUrl: string | null;
  file1Url: string; file1Name: string;
  file2Url: string; file2Name: string;
  file3Url: string; file3Name: string;
}

// How many times to re-roll a colliding pattern code before giving up. With
// 27^6 (~387 million) possible codes a single retry is already unlikely;
// five makes exhausting them effectively impossible.
const MAX_CODE_ATTEMPTS = 5;

export const patternService = {
  /**
   * Creates a pattern with a system-generated code. The code is minted here
   * (never supplied by the client) and its uniqueness is enforced by the
   * database's @@unique([businessId, patternCode]) — a P2002 means another
   * request won the same code, so we simply re-roll rather than failing.
   */
  async create(input: PatternCreateInput, actorId: string, businessId: string) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const patternCode = generatePatternCode();
      try {
        const pattern = await prisma.$transaction(async (tx) => {
          const created = await tx.pattern.create({
            data: { ...input, patternCode, businessId, createdById: actorId },
          });
          await auditService.log(tx, {
            businessId, actorId, action: "PATTERN_CREATED", entityType: "Pattern", entityId: created.id,
            metadata: { patternCode },
          });
          return created;
        });
        return pattern;
      } catch (e) {
        const isCodeCollision =
          typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
        if (!isCodeCollision) throw e;
        // else: fall through and re-roll
      }
    }
    throw new ConflictError("Could not allocate a unique pattern ID. Please try again.");
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
