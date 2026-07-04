import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/api/errors";
import { auditService } from "./audit.service";

const D = (n: number) => new Prisma.Decimal(n);

// Expense ledger — costs recorded against a receipt. Record-only for now: no
// effect on the receipt's balance/paymentStatus (a future income/profit
// module will read these to compute margins).
export const expenseService = {
  async record(receiptId: string, input: { description: string; amount: number }, actorId: string) {
    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, select: { id: true } });
    if (!receipt) throw new NotFoundError("Receipt");

    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          receiptId,
          description: input.description,
          amount: D(input.amount),
          recordedById: actorId,
        },
      });
      await auditService.log(tx, {
        actorId, action: "EXPENSE_RECORDED", entityType: "Expense", entityId: expense.id,
        metadata: { receiptId, description: input.description, amount: input.amount },
      });
      return expense;
    });
  },

  async remove(expenseId: string, actorId: string) {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundError("Expense");

    return prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id: expenseId } });
      await auditService.log(tx, {
        actorId, action: "EXPENSE_DELETED", entityType: "Expense", entityId: expenseId,
        metadata: { receiptId: expense.receiptId, description: expense.description, amount: Number(expense.amount) },
      });
      return expense;
    });
  },
};
