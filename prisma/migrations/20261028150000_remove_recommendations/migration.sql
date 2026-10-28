-- Removes the Recommendations feature completely: its two cache tables, the
-- TrendRegion enum, and the RECOMMENDATIONS value of the Section enum.
--
-- DESTRUCTIVE: drops "Recommendation" and "TrendSnapshot" and the data in them
-- (generated trend caches; nothing in the app reads them any more). Plans that
-- listed RECOMMENDATIONS have it removed first, otherwise the enum change below
-- would fail on those rows.

UPDATE "Plan"
SET "enabledSections" = array_remove("enabledSections", 'RECOMMENDATIONS'::"Section")
WHERE 'RECOMMENDATIONS'::"Section" = ANY("enabledSections");

-- AlterEnum
BEGIN;
CREATE TYPE "Section_new" AS ENUM ('CUSTOMERS', 'RECEIPTS', 'ORDERS', 'PRODUCTION', 'EXPENSES', 'INCOME', 'STYLES', 'TEAM', 'AUDIT_LOG', 'SETTINGS', 'INVENTORY', 'SALES');
ALTER TABLE "Plan" ALTER COLUMN "enabledSections" TYPE "Section_new"[] USING ("enabledSections"::text::"Section_new"[]);
ALTER TYPE "Section" RENAME TO "Section_old";
ALTER TYPE "Section_new" RENAME TO "Section";
DROP TYPE "Section_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Recommendation" DROP CONSTRAINT "Recommendation_businessId_fkey";

-- DropTable
DROP TABLE "TrendSnapshot";

-- DropTable
DROP TABLE "Recommendation";

-- DropEnum
DROP TYPE "TrendRegion";

