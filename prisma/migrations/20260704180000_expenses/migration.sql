-- New audit actions for the expense ledger.
ALTER TYPE "AuditAction" ADD VALUE 'EXPENSE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'EXPENSE_DELETED';

-- Expense ledger: costs recorded against a receipt (record-only for now).
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_receiptId_idx" ON "Expense"("receiptId");
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
