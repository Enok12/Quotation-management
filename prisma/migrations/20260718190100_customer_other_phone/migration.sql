-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "otherPhone" TEXT;

-- CreateIndex
CREATE INDEX "Customer_otherPhone_idx" ON "Customer"("otherPhone");
