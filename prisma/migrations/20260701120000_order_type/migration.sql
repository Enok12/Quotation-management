-- Order type: bulk (normal, default) vs single-unit sample.
CREATE TYPE "OrderType" AS ENUM ('BULK', 'SAMPLE');

-- Existing receipts become BULK via the column default.
ALTER TABLE "Receipt" ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'BULK';
CREATE INDEX "Receipt_orderType_idx" ON "Receipt"("orderType");

-- New audit action for receipt deletion (rejected samples).
ALTER TYPE "AuditAction" ADD VALUE 'RECEIPT_DELETED';
