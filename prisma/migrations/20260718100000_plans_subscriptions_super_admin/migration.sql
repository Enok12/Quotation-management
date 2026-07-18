-- Super Admin platform role, Plans (named bundles of enabled sections), and
-- per-business subscription status. No payment provider wired up yet — plan
-- assignment and subscription status are both set by hand by a Super Admin;
-- real billing can flip Business.subscriptionStatus/planId later without any
-- enforcement code changing.

-- New audit actions.
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_PLAN_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'BUSINESS_SUBSCRIPTION_STATUS_CHANGED';

-- Gate-able dashboard sections.
CREATE TYPE "Section" AS ENUM ('CUSTOMERS', 'RECEIPTS', 'ORDERS', 'PRODUCTION', 'EXPENSES', 'INCOME', 'TEAM', 'AUDIT_LOG', 'SETTINGS');

-- Subscription lifecycle. ACTIVE/TRIAL = good standing; EXPIRED/CANCELLED = locked out.
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED');

-- Platform-level flag — never settable via any UI/API, only by hand in the DB.
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Plans: named bundles of enabled sections.
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabledSections" "Section"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- Seed a "Full Access" plan with every section enabled — every existing
-- business gets assigned to it below, so nothing changes for anyone today.
INSERT INTO "Plan" ("id", "name", "enabledSections", "updatedAt")
VALUES (
  'plan_full_access_default',
  'Full Access',
  ARRAY['CUSTOMERS','RECEIPTS','ORDERS','PRODUCTION','EXPENSES','INCOME','TEAM','AUDIT_LOG','SETTINGS']::"Section"[],
  CURRENT_TIMESTAMP
);

-- Business entitlements: add nullable first, backfill, then require.
ALTER TABLE "Business" ADD COLUMN "planId" TEXT;
ALTER TABLE "Business" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Business" ADD COLUMN "subscriptionRenewsAt" TIMESTAMP(3);

UPDATE "Business" SET "planId" = 'plan_full_access_default' WHERE "planId" IS NULL;

ALTER TABLE "Business" ALTER COLUMN "planId" SET NOT NULL;
ALTER TABLE "Business" ADD CONSTRAINT "Business_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
