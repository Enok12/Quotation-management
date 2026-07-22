-- Styles module: patterns uploaded by a Pattern Maker, assigned to order items.

-- New role. A pattern maker is deliberately narrow: they only ever see the
-- Styles section (enforced by ROLE_SECTIONS in src/lib/section-access.ts).
ALTER TYPE "Role" ADD VALUE 'PATTERN_MAKER';

-- New gateable section, so a business's plan can include (or exclude) Styles.
ALTER TYPE "Section" ADD VALUE 'STYLES';

CREATE TABLE "Pattern" (
  "id"          TEXT NOT NULL,
  "businessId"  TEXT NOT NULL,
  "patternCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageUrl"    TEXT,
  "file1Url"    TEXT NOT NULL,
  "file2Url"    TEXT NOT NULL,
  "file3Url"    TEXT NOT NULL,
  "file1Name"   TEXT NOT NULL,
  "file2Name"   TEXT NOT NULL,
  "file3Name"   TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

-- Unique per business, not globally -- two businesses may each mint the same
-- random code without colliding (same rule as receipt numbers).
CREATE UNIQUE INDEX "Pattern_businessId_patternCode_key" ON "Pattern"("businessId", "patternCode");
CREATE INDEX "Pattern_businessId_idx"  ON "Pattern"("businessId");
CREATE INDEX "Pattern_createdById_idx" ON "Pattern"("createdById");

ALTER TABLE "Pattern" ADD CONSTRAINT "Pattern_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pattern" ADD CONSTRAINT "Pattern_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nullable and NOT unique: one pattern is reusable across many order items.
-- SET NULL on delete so removing a pattern never destroys live order items.
ALTER TABLE "ReceiptItem" ADD COLUMN "patternId" TEXT;
CREATE INDEX "ReceiptItem_patternId_idx" ON "ReceiptItem"("patternId");
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_patternId_fkey"
  FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;
