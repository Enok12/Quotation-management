-- Expense categories restructure: "Sewing" is retired in favor of more
-- granular Pattern Making / Cutting / Production. Table has no rows yet
-- (Expenses module is brand new), so no backfill is needed.
ALTER TABLE "ExpenseRecord" DROP COLUMN "sewingExpense";
ALTER TABLE "ExpenseRecord" ADD COLUMN "patternMakingExpense" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ExpenseRecord" ADD COLUMN "cuttingExpense" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ExpenseRecord" ADD COLUMN "productionExpense" DECIMAL(12,2) NOT NULL DEFAULT 0;
