-- Drop the legacy free-text category column on InventoryProduct.
-- Data was backfilled onto InventoryCategory + InventoryProduct.categoryId
-- by a one-off script before this migration was written; the 5 existing
-- rows in Dummy Business were verified to have carried over correctly.
ALTER TABLE "InventoryProduct" DROP COLUMN "category";
