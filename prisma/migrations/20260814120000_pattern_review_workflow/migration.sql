-- Pattern review workflow: bulk-uploaded .mdl patterns start PENDING_REVIEW and
-- become FINALIZED once an admin adds a description (+ optional picture).

CREATE TYPE "PatternStatus" AS ENUM ('PENDING_REVIEW', 'FINALIZED');

ALTER TYPE "AuditAction" ADD VALUE 'PATTERN_FINALIZED';
ALTER TYPE "AuditAction" ADD VALUE 'PATTERN_DELETED';

-- New columns. status defaults to PENDING_REVIEW for future uploads; existing
-- rows are backfilled to FINALIZED below.
ALTER TABLE "Pattern" ADD COLUMN "status" "PatternStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "Pattern" ADD COLUMN "finalizedById" TEXT;
ALTER TABLE "Pattern" ADD COLUMN "finalizedAt" TIMESTAMP(3);

-- Description is now filled at review time, so it may be null before then.
ALTER TABLE "Pattern" ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "Pattern" ADD CONSTRAINT "Pattern_finalizedById_fkey"
  FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: patterns created before this change already have descriptions and
-- were assignable — keep them FINALIZED so nothing that worked stops working.
UPDATE "Pattern" SET "status" = 'FINALIZED';
