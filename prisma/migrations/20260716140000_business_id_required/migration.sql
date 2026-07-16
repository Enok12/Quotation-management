-- Every write path now supplies businessId (verified: zero existing rows are
-- missing it), so tighten it from nullable to required on the four models
-- that were transitioned in the prior migration.
ALTER TABLE "Customer" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "Receipt" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "CustomerInvite" ALTER COLUMN "businessId" SET NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "businessId" SET NOT NULL;
