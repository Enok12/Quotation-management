-- Men's / Women's top-level split for the computer folder sync and receipt creation.
CREATE TYPE "Category" AS ENUM ('MEN', 'WOMEN');

ALTER TABLE "Receipt" ADD COLUMN "category" "Category" NOT NULL DEFAULT 'MEN';
