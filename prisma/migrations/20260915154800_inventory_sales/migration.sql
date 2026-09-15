-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INVENTORY_SALE_RECORDED';

-- AlterEnum
ALTER TYPE "Section" ADD VALUE 'SALES';

-- CreateTable
CREATE TABLE "InventorySale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "costPriceAtSale" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "note" TEXT,
    "soldById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventorySale_businessId_idx" ON "InventorySale"("businessId");

-- CreateIndex
CREATE INDEX "InventorySale_productId_idx" ON "InventorySale"("productId");

-- CreateIndex
CREATE INDEX "InventorySale_createdAt_idx" ON "InventorySale"("createdAt");

-- AddForeignKey
ALTER TABLE "InventorySale" ADD CONSTRAINT "InventorySale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySale" ADD CONSTRAINT "InventorySale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySale" ADD CONSTRAINT "InventorySale_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
