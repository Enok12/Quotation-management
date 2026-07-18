import type { Section, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db";
import { ForbiddenError } from "./api/errors";

export interface BusinessAccess {
  enabledSections: Section[];
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  inGoodStanding: boolean;
}

// A business's actual entitlements = its plan's sections, but only while its
// subscription is in good standing (ACTIVE or TRIAL) — EXPIRED/CANCELLED
// drops it to zero sections regardless of plan. No payment provider wired up
// yet, so both planId and subscriptionStatus are set by hand by a Super
// Admin for now; real billing can flip subscriptionStatus later without any
// of this resolution logic changing.
export async function getBusinessAccess(businessId: string): Promise<BusinessAccess> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { subscriptionStatus: true, plan: { select: { name: true, enabledSections: true } } },
  });
  const inGoodStanding = business.subscriptionStatus === "ACTIVE" || business.subscriptionStatus === "TRIAL";
  return {
    enabledSections: inGoodStanding ? business.plan.enabledSections : [],
    planName: business.plan.name,
    subscriptionStatus: business.subscriptionStatus,
    inGoodStanding,
  };
}

export function hasSection(access: BusinessAccess, section: Section): boolean {
  return access.enabledSections.includes(section);
}

// For API routes: throws a clean 403 (via the handler() wrapper) instead of
// rendering a page — used as defense-in-depth on the more sensitive mutating
// routes, so a disabled section can't be bypassed by calling the API directly.
export async function requireSection(businessId: string, section: Section): Promise<void> {
  const access = await getBusinessAccess(businessId);
  if (!hasSection(access, section)) {
    throw new ForbiddenError("This isn't available on your business's current plan.");
  }
}
