-- Permanent public tracking-page token for BULK orders (null for SAMPLE).
ALTER TABLE "Receipt" ADD COLUMN "trackingToken" TEXT;
CREATE UNIQUE INDEX "Receipt_trackingToken_key" ON "Receipt"("trackingToken");

-- Backfill existing BULK receipts with a token so they get tracking links too.
UPDATE "Receipt"
SET "trackingToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "orderType" = 'BULK' AND "trackingToken" IS NULL;
