-- Per-business invoice numbering: receiptNumber no longer auto-assigns at
-- insert time via a shared global sequence, and is no longer globally unique.
-- Each business gets its own atomic counter (Business.lastReceiptNumber),
-- incremented explicitly in application code only when a receipt is
-- confirmed (see receiptService) — Unconfirmed Bulk receipts stay null.

-- New per-business counter.
ALTER TABLE "Business" ADD COLUMN "lastReceiptNumber" INTEGER NOT NULL DEFAULT 0;

-- New audit action for the unconfirmed -> confirmed transition.
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_CONFIRMED';

-- receiptNumber: drop the old autoincrement default and NOT NULL — assigned
-- explicitly (or left null) in application code from now on.
ALTER TABLE "Receipt" ALTER COLUMN "receiptNumber" DROP NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "receiptNumber" DROP DEFAULT;

-- Drop the old globally-unique index and the old plain per-column indexes,
-- replaced by one composite index that is unique per business (Postgres
-- allows multiple NULLs under a unique index, so any number of Unconfirmed
-- receipts per business coexist fine).
DROP INDEX "Receipt_receiptNumber_key";
DROP INDEX "Receipt_receiptNumber_idx";
DROP INDEX "Receipt_businessId_idx";
CREATE UNIQUE INDEX "Receipt_businessId_receiptNumber_key" ON "Receipt"("businessId", "receiptNumber");

-- The old global sequence is no longer referenced by anything.
DROP SEQUENCE IF EXISTS "Receipt_receiptNumber_seq";
