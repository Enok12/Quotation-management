-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'INVENTORY_CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVENTORY_CATEGORY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVENTORY_CATEGORY_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'INVENTORY_RETURN_PROCESSED';

-- AlterTable
ALTER TABLE "InventoryProduct" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReturn" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "processedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryCategory_businessId_idx" ON "InventoryCategory"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_businessId_name_key" ON "InventoryCategory"("businessId", "name");

-- CreateIndex
CREATE INDEX "InventoryReturn_businessId_idx" ON "InventoryReturn"("businessId");

-- CreateIndex
CREATE INDEX "InventoryReturn_saleItemId_idx" ON "InventoryReturn"("saleItemId");

-- CreateIndex
CREATE INDEX "InventoryReturn_productId_idx" ON "InventoryReturn"("productId");

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReturn" ADD CONSTRAINT "InventoryReturn_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReturn" ADD CONSTRAINT "InventoryReturn_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "InventorySaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReturn" ADD CONSTRAINT "InventoryReturn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReturn" ADD CONSTRAINT "InventoryReturn_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
