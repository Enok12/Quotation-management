-- Multi-tenant foundation: Business / BusinessMember / StaffInvite, plus a
-- nullable businessId on the models that need to become tenant-scoped.
-- Existing production data is backfilled into one "MONTRA" business so
-- nothing already in the database is orphaned or changes behavior.

-- ------------------------- New tables -------------------------
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- Fixed, readable id (not a real cuid, but Postgres doesn't care — Prisma's
-- cuid() default only applies to inserts made through Prisma Client).
INSERT INTO "Business" ("id", "name", "createdAt", "updatedAt")
VALUES ('business_montra_default', 'MONTRA', NOW(), NOW());

CREATE TABLE "BusinessMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessMember_businessId_userId_key" ON "BusinessMember"("businessId", "userId");
CREATE INDEX "BusinessMember_userId_idx" ON "BusinessMember"("userId");
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Capture every existing user's current role into BusinessMember, under the
-- MONTRA business, BEFORE that column is dropped from User below.
INSERT INTO "BusinessMember" ("id", "businessId", "userId", "role", "createdAt")
SELECT gen_random_uuid()::text, 'business_montra_default', "id", "role", NOW()
FROM "User";

CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffInvite_token_key" ON "StaffInvite"("token");
CREATE INDEX "StaffInvite_token_idx" ON "StaffInvite"("token");
CREATE INDEX "StaffInvite_businessId_idx" ON "StaffInvite"("businessId");
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------- User: role -> activeBusinessId -------------------------
ALTER TABLE "User" ADD COLUMN "activeBusinessId" TEXT;
UPDATE "User" SET "activeBusinessId" = 'business_montra_default';
ALTER TABLE "User" ADD CONSTRAINT "User_activeBusinessId_fkey" FOREIGN KEY ("activeBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Now safe to drop — every user's role is preserved in BusinessMember above.
ALTER TABLE "User" DROP COLUMN "role";

-- ------------------------- Backfill businessId on existing tables -------------------------
ALTER TABLE "Customer" ADD COLUMN "businessId" TEXT;
UPDATE "Customer" SET "businessId" = 'business_montra_default';
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Receipt" ADD COLUMN "businessId" TEXT;
UPDATE "Receipt" SET "businessId" = 'business_montra_default';
CREATE INDEX "Receipt_businessId_idx" ON "Receipt"("businessId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerInvite" ADD COLUMN "businessId" TEXT;
UPDATE "CustomerInvite" SET "businessId" = 'business_montra_default';
CREATE INDEX "CustomerInvite_businessId_idx" ON "CustomerInvite"("businessId");
ALTER TABLE "CustomerInvite" ADD CONSTRAINT "CustomerInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD COLUMN "businessId" TEXT;
UPDATE "AuditLog" SET "businessId" = 'business_montra_default';
CREATE INDEX "AuditLog_businessId_idx" ON "AuditLog"("businessId");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
