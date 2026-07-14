-- Women's is now the default category for new receipts (existing rows untouched).
ALTER TABLE "Receipt" ALTER COLUMN "category" SET DEFAULT 'WOMEN';
