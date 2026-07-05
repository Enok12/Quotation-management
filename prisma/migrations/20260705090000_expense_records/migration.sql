-- New audit actions for the restructured expense-record ledger.
ALTER TYPE "AuditAction" ADD VALUE 'EXPENSE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'EXPENSE_FINALIZED';
ALTER TYPE "AuditAction" ADD VALUE 'EXPENSE_UNFINALIZED';

-- Structured, one-row-per-receipt expense record replacing the free-form Expense ledger.
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "fabricExpense" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sewingExpense" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "accessoryExpense" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherExpense" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "recordedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExpenseRecord_receiptId_key" ON "ExpenseRecord"("receiptId");
CREATE INDEX "ExpenseRecord_finalized_idx" ON "ExpenseRecord"("finalized");

ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing free-form Expense rows into the new structure: sum per
-- receipt into "Other Expense", left unfinalized so nothing silently
-- appears on the Income page until an admin reviews and finalizes it.
INSERT INTO "ExpenseRecord" ("id", "receiptId", "otherExpense", "profit", "finalized", "recordedById", "updatedAt", "createdAt")
SELECT
    'exprec_' || e."receiptId",
    e."receiptId",
    SUM(e."amount"),
    r."totalDue" - SUM(e."amount"),
    false,
    (ARRAY_AGG(e."recordedById" ORDER BY e."createdAt"))[1],
    NOW(),
    NOW()
FROM "Expense" e
JOIN "Receipt" r ON r."id" = e."receiptId"
GROUP BY e."receiptId", r."totalDue";

-- Drop the old free-form ledger.
DROP TABLE "Expense";
