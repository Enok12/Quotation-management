-- Recommendations section: gateable section, region enum, and two caches.

ALTER TYPE "Section" ADD VALUE 'RECOMMENDATIONS';

CREATE TYPE "TrendRegion" AS ENUM ('LOCAL', 'GLOBAL');

-- Shared across all businesses (trend data is identical for everyone).
CREATE TABLE "TrendSnapshot" (
  "id"        TEXT NOT NULL,
  "region"    "TrendRegion" NOT NULL,
  "periodKey" TEXT NOT NULL,
  "data"      JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrendSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrendSnapshot_region_periodKey_key" ON "TrendSnapshot"("region", "periodKey");

-- Per business: generated recommendation cards for a region+month.
CREATE TABLE "Recommendation" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "region"     "TrendRegion" NOT NULL,
  "periodKey"  TEXT NOT NULL,
  "data"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Recommendation_businessId_region_periodKey_key" ON "Recommendation"("businessId", "region", "periodKey");
CREATE INDEX "Recommendation_businessId_idx" ON "Recommendation"("businessId");
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
