-- Sample→bulk conversion link. Records, on the sample, which bulk it became.

ALTER TABLE "Receipt" ADD COLUMN "convertedToBulkId" TEXT;

-- 1:1 + self FK. onDelete SET NULL: deleting the bulk just un-marks the sample.
CREATE UNIQUE INDEX "Receipt_convertedToBulkId_key" ON "Receipt"("convertedToBulkId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_convertedToBulkId_fkey"
  FOREIGN KEY ("convertedToBulkId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from the audit trail: conversion logs a RECEIPT_CREATED entry on the
-- NEW bulk (entityId = bulk id) carrying metadata.fromSampleId. Point each such
-- sample at its bulk. Guard on the bulk still existing (FK) and on there being
-- no existing/duplicate mapping (uniqueness) via DISTINCT ON the sample.
UPDATE "Receipt" s
SET "convertedToBulkId" = m."bulkId"
FROM (
  SELECT DISTINCT ON (a."metadata" ->> 'fromSampleId')
         a."metadata" ->> 'fromSampleId' AS "sampleId",
         a."entityId"                    AS "bulkId"
  FROM "AuditLog" a
  WHERE a."action" = 'RECEIPT_CREATED'
    AND a."entityType" = 'Receipt'
    AND a."metadata" ->> 'fromSampleId' IS NOT NULL
    AND EXISTS (SELECT 1 FROM "Receipt" b WHERE b."id" = a."entityId")
  ORDER BY a."metadata" ->> 'fromSampleId', a."createdAt" ASC
) m
WHERE s."id" = m."sampleId" AND s."orderType" = 'SAMPLE';
