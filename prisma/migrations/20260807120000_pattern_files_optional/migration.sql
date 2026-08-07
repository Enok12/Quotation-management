-- The three pattern attachments (DXF/HPGL/RUL) become optional. Dropping
-- NOT NULL is a widening change, so existing patterns (which all have files)
-- remain valid with no backfill.
ALTER TABLE "Pattern" ALTER COLUMN "file1Url"  DROP NOT NULL;
ALTER TABLE "Pattern" ALTER COLUMN "file2Url"  DROP NOT NULL;
ALTER TABLE "Pattern" ALTER COLUMN "file3Url"  DROP NOT NULL;
ALTER TABLE "Pattern" ALTER COLUMN "file1Name" DROP NOT NULL;
ALTER TABLE "Pattern" ALTER COLUMN "file2Name" DROP NOT NULL;
ALTER TABLE "Pattern" ALTER COLUMN "file3Name" DROP NOT NULL;
