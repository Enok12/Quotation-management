import type { Role, Section, SubscriptionStatus } from "@prisma/client";
import { prisma } from "./db";
import { ForbiddenError } from "./api/errors";

export interface BusinessAccess {
  enabledSections: Section[];
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  inGoodStanding: boolean;
}

// What each role is allowed to reach, INDEPENDENT of the business's plan.
// "ALL" means "whatever the plan includes" — the historical behaviour for
// Admin and Staff. A narrow role lists its sections explicitly.
//
// This is a second, orthogonal gate to the plan: the plan answers "does this
// business pay for this feature", the role answers "should this person see
// it". A Pattern Maker is an outside contractor who uploads patterns, so
// they get Styles and nothing else — not Customers, not money, not Settings.
export const ROLE_SECTIONS: Record<Role, Section[] | "ALL"> = {
  ADMIN: "ALL",
  STAFF: "ALL",
  PATTERN_MAKER: ["STYLES"],
};

/**
 * A user's actual entitlements = their business's plan sections, intersected
 * with what their role permits, and only while the subscription is in good
 * standing (ACTIVE or TRIAL) — EXPIRED/CANCELLED drops to zero sections
 * regardless of plan or role.
 *
 * `role` is required, not optional, deliberately: an optional parameter would
 * let a call site silently skip the role gate and hand a Pattern Maker the
 * whole app. Making it required turns that mistake into a compile error.
 */
export async function getBusinessAccess(businessId: string, role: Role): Promise<BusinessAccess> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { subscriptionStatus: true, plan: { select: { name: true, enabledSections: true } } },
  });
  const inGoodStanding = business.subscriptionStatus === "ACTIVE" || business.subscriptionStatus === "TRIAL";

  const allowedForRole = ROLE_SECTIONS[role];
  const planSections = inGoodStanding ? business.plan.enabledSections : [];
  const enabledSections =
    allowedForRole === "ALL" ? planSections : planSections.filter((s) => allowedForRole.includes(s));

  return {
    enabledSections,
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
export async function requireSection(businessId: string, role: Role, section: Section): Promise<void> {
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, section)) {
    throw new ForbiddenError("This isn't available on your business's current plan.");
  }
}
