/*
  Warnings:

  - You are about to drop the column `costPriceAtSale` on the `InventorySale` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `InventorySale` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `InventorySale` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `InventorySale` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "InventorySale" DROP CONSTRAINT "InventorySale_productId_fkey";

-- DropIndex
DROP INDEX "InventorySale_productId_idx";

-- AlterTable
ALTER TABLE "InventorySale" DROP COLUMN "costPriceAtSale",
DROP COLUMN "productId",
DROP COLUMN "quantity",
DROP COLUMN "unitPrice";

-- CreateTable
CREATE TABLE "InventorySaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "costPriceAtSale" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InventorySaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventorySaleItem_saleId_idx" ON "InventorySaleItem"("saleId");

-- CreateIndex
CREATE INDEX "InventorySaleItem_productId_idx" ON "InventorySaleItem"("productId");

-- AddForeignKey
ALTER TABLE "InventorySaleItem" ADD CONSTRAINT "InventorySaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "InventorySale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySaleItem" ADD CONSTRAINT "InventorySaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
