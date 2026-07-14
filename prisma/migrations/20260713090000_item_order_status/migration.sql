-- Production tracking moves from per-receipt to per-item.

-- Each item gets its own status, defaulting to Fabric Selection.
ALTER TABLE "ReceiptItem" ADD COLUMN "orderStatus" "OrderStatus" NOT NULL DEFAULT 'FABRIC_SELECTION';

-- Backfill: seed every existing item with its receipt's CURRENT status, so
-- in-flight orders don't appear to regress to square one.
UPDATE "ReceiptItem" ri
SET "orderStatus" = r."orderStatus"
FROM "Receipt" r
WHERE r.id = ri."receiptId";

-- History rows now attribute to a specific item going forward.
ALTER TABLE "OrderStatusHistory" ADD COLUMN "itemId" TEXT;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ReceiptItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "OrderStatusHistory_itemId_idx" ON "OrderStatusHistory"("itemId");

-- Backfill itemId on existing history rows only where it's unambiguous —
-- a receipt with exactly one item. Multi-item receipts' historic rows were
-- genuinely receipt-wide and are left unattributed rather than guessed at.
UPDATE "OrderStatusHistory" h
SET "itemId" = ri.id
FROM "ReceiptItem" ri
WHERE h."receiptId" = ri."receiptId"
  AND h."itemId" IS NULL
  AND (SELECT COUNT(*) FROM "ReceiptItem" ri2 WHERE ri2."receiptId" = h."receiptId") = 1;
