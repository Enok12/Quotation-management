-- Bulk and Sample orders become two independent invoice sequences.
--
-- "lastReceiptNumber" keeps its name and its current value, and now means the
-- BULK counter specifically -- deliberate, so every already-issued bulk
-- invoice keeps the exact number printed on the copy the customer holds. No
-- existing receipt is renumbered by this migration.
ALTER TABLE "Business" ADD COLUMN "lastSampleNumber" INTEGER NOT NULL DEFAULT 0;

-- Widen the uniqueness rule from (business, number) to
-- (business, orderType, number) so Bulk #1 and Sample #1 can coexist as
-- different orders. Strictly more permissive than the old constraint, so
-- existing rows cannot violate it.
DROP INDEX "Receipt_businessId_receiptNumber_key";
CREATE UNIQUE INDEX "Receipt_businessId_orderType_receiptNumber_key"
  ON "Receipt"("businessId", "orderType", "receiptNumber");

-- Seed each business's Sample counter from any Sample orders that already
-- carry a number under the old shared sequence, so the next Sample issued
-- cannot collide with one of them. (No such rows exist today, but this makes
-- the migration correct for any environment where they do.)
UPDATE "Business" b
SET "lastSampleNumber" = COALESCE(
  (SELECT MAX(r."receiptNumber") FROM "Receipt" r
    WHERE r."businessId" = b."id" AND r."orderType" = 'SAMPLE' AND r."receiptNumber" IS NOT NULL),
  0
);
