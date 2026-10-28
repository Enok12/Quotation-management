-- CreateEnum
CREATE TYPE "SaleFulfilment" AS ENUM ('IN_STORE', 'COD_DELIVERY');

-- CreateEnum
CREATE TYPE "CodStatus" AS ENUM ('PENDING_CONFIRMATION', 'PENDING_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REMITTED', 'REFUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryFeePayer" AS ENUM ('CUSTOMER', 'BUSINESS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'COD_SALE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'COD_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'COD_DISPATCHED';
ALTER TYPE "AuditAction" ADD VALUE 'COD_DELIVERED';
ALTER TYPE "AuditAction" ADD VALUE 'COD_REFUSED';
ALTER TYPE "AuditAction" ADD VALUE 'COD_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'COD_SETTLED';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "codEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codRefusalWarnThreshold" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "lastDispatchNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventorySale" ADD COLUMN     "fulfilment" "SaleFulfilment" NOT NULL DEFAULT 'IN_STORE';

-- CreateTable
CREATE TABLE "InventorySaleDelivery" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "dispatchRef" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerPhone2" TEXT,
    "customerPhoneNormalized" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "city" TEXT,
    "courierName" TEXT,
    "waybillNo" TEXT,
    "codAmount" DECIMAL(12,2) NOT NULL,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feePaidBy" "DeliveryFeePayer" NOT NULL DEFAULT 'CUSTOMER',
    "status" "CodStatus" NOT NULL DEFAULT 'PENDING_DISPATCH',
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "remittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "confirmToken" TEXT,
    "confirmExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySaleDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodSettlement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "courierName" TEXT NOT NULL,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "grossCollected" DECIMAL(12,2) NOT NULL,
    "feesDeducted" DECIMAL(12,2) NOT NULL,
    "netReceived" DECIMAL(12,2) NOT NULL,
    "variance" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventorySaleDelivery_saleId_key" ON "InventorySaleDelivery"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySaleDelivery_confirmToken_key" ON "InventorySaleDelivery"("confirmToken");

-- CreateIndex
CREATE INDEX "InventorySaleDelivery_businessId_status_idx" ON "InventorySaleDelivery"("businessId", "status");

-- CreateIndex
CREATE INDEX "InventorySaleDelivery_businessId_customerPhoneNormalized_st_idx" ON "InventorySaleDelivery"("businessId", "customerPhoneNormalized", "status");

-- CreateIndex
CREATE INDEX "InventorySaleDelivery_settlementId_idx" ON "InventorySaleDelivery"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySaleDelivery_businessId_dispatchRef_key" ON "InventorySaleDelivery"("businessId", "dispatchRef");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySaleDelivery_businessId_courierName_waybillNo_key" ON "InventorySaleDelivery"("businessId", "courierName", "waybillNo");

-- CreateIndex
CREATE INDEX "CodSettlement_businessId_receivedAt_idx" ON "CodSettlement"("businessId", "receivedAt");

-- AddForeignKey
ALTER TABLE "InventorySaleDelivery" ADD CONSTRAINT "InventorySaleDelivery_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "InventorySale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySaleDelivery" ADD CONSTRAINT "InventorySaleDelivery_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySaleDelivery" ADD CONSTRAINT "InventorySaleDelivery_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CodSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodSettlement" ADD CONSTRAINT "CodSettlement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodSettlement" ADD CONSTRAINT "CodSettlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

