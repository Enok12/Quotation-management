-- Styles: collapse the three attachment slots (DXF/HPGL/RUL) into a single
-- Module (.mdl) file. The first file is preserved as the module; the 2nd/3rd
-- are no longer used and are dropped.
ALTER TABLE "Pattern" RENAME COLUMN "file1Url"  TO "moduleFileUrl";
ALTER TABLE "Pattern" RENAME COLUMN "file1Name" TO "moduleFileName";
ALTER TABLE "Pattern" DROP COLUMN "file2Url";
ALTER TABLE "Pattern" DROP COLUMN "file2Name";
ALTER TABLE "Pattern" DROP COLUMN "file3Url";
ALTER TABLE "Pattern" DROP COLUMN "file3Name";
