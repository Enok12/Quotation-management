-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_RECORDED';

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod",
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_receiptId_idx" ON "Payment"("receiptId");

-- CreateIndex
CREATE INDEX "Receipt_paymentStatus_idx" ON "Receipt"("paymentStatus");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
