import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, ForbiddenError } from "@/lib/api/errors";
import { auditService } from "./audit.service";

const D = (n: number) => new Prisma.Decimal(n);

export interface ExpenseRecordInput {
  fabricExpense: number;
  sewingExpense: number;
  accessoryExpense: number;
  otherExpense: number;
  profit: number;
}

// Structured, one-row-per-receipt cost ledger (fabric/sewing/accessory/other).
// Profit is stored as submitted — the client auto-calculates it until the
// user types over it, so the server just trusts whatever number arrives.
// Finalizing locks the record and is what makes it visible to the Income page.
export const expenseRecordService = {
  async upsert(receiptId: string, input: ExpenseRecordInput, actorId: string) {
    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, select: { id: true } });
    if (!receipt) throw new NotFoundError("Receipt");

    const existing = await prisma.expenseRecord.findUnique({ where: { receiptId } });
    if (existing?.finalized) throw new ForbiddenError("Unlock this record before editing it");

    const data = {
      fabricExpense: D(input.fabricExpense),
      sewingExpense: D(input.sewingExpense),
      accessoryExpense: D(input.accessoryExpense),
      otherExpense: D(input.otherExpense),
      profit: D(input.profit),
    };

    return prisma.$transaction(async (tx) => {
      const record = await tx.expenseRecord.upsert({
        where: { receiptId },
        create: { receiptId, recordedById: actorId, ...data },
        update: data,
      });
      await auditService.log(tx, {
        actorId, action: "EXPENSE_UPDATED", entityType: "ExpenseRecord", entityId: record.id,
        metadata: { receiptId, ...input },
      });
      return record;
    });
  },

  async setFinalized(receiptId: string, finalized: boolean, actorId: string) {
    const record = await prisma.expenseRecord.findUnique({ where: { receiptId } });
    if (!record) throw new NotFoundError("Expense record");

    return prisma.$transaction(async (tx) => {
      const updated = await tx.expenseRecord.update({
        where: { receiptId },
        data: finalized
          ? { finalized: true, finalizedAt: new Date(), finalizedById: actorId }
          : { finalized: false, finalizedAt: null, finalizedById: null },
      });
      await auditService.log(tx, {
        actorId, action: finalized ? "EXPENSE_FINALIZED" : "EXPENSE_UNFINALIZED",
        entityType: "ExpenseRecord", entityId: updated.id,
        metadata: { receiptId },
      });
      return updated;
    });
  },
};
