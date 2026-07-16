import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./db";
import { ForbiddenError } from "./api/errors";

// Resolve the current Clerk user to our local User row (creating it on first
// sight). Identity always comes from the verified session, never the request body.
//
// The Clerk profile (email/name) is only fetched on first sight — `auth()` is
// a local JWT check, but `currentUser()` is a network call to Clerk, so it'd
// add latency to every request if done unconditionally. A P2002 on create
// means a concurrent first request already won the race; re-fetch instead.
export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new ForbiddenError("Authentication required");

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const realEmail = clerkUser?.primaryEmailAddress?.emailAddress;
  const email = realEmail ?? `${userId}@pending.local`;
  const name = clerkUser ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null : null;

  // A row for this email may already exist under a different clerkId — e.g.
  // this person used the app on a prior Clerk instance (dev vs. production
  // don't share users, so switching gives everyone a new clerkId). Reattach
  // to that existing row — and its business memberships/history — instead of
  // creating an orphaned duplicate that looks like a brand-new user.
  if (realEmail) {
    const byEmail = await prisma.user.findUnique({ where: { email: realEmail } });
    if (byEmail && byEmail.clerkId !== userId) {
      try {
        return await prisma.user.update({ where: { id: byEmail.id }, data: { clerkId: userId } });
      } catch {
        const reattached = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (reattached) return reattached;
      }
    }
  }

  try {
    return await prisma.user.create({ data: { clerkId: userId, email, name } });
  } catch {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) throw new ForbiddenError("Failed to resolve account");
    return user;
  }
}

// Resolves identity + which business the user is currently acting within +
// their role in it, in one place. A user's role can differ per business
// (e.g. Admin of their own, Staff if invited into someone else's), so it's
// never a fixed property of the user themselves — always looked up fresh
// against their current membership.
export async function requireBusiness() {
  const user = await requireUser();
  if (!user.activeBusinessId) throw new ForbiddenError("No active business selected");
  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: user.activeBusinessId, userId: user.id } },
  });
  if (!membership) throw new ForbiddenError("Not a member of this business");
  return { ...user, businessId: membership.businessId, role: membership.role };
}

export async function requireAdmin() {
  const ctx = await requireBusiness();
  if (ctx.role !== "ADMIN") throw new ForbiddenError("Administrator access required");
  return ctx;
}
