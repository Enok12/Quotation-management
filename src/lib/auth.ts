import { auth } from "@clerk/nextjs/server";
import { prisma } from "./db";
import { ForbiddenError } from "./api/errors";

// Resolve the current Clerk user to our local User row (creating it on first
// sight). Identity always comes from the verified session, never the request body.
export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new ForbiddenError("Authentication required");
  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: { clerkId: userId, email: `${userId}@pending.local` },
  });
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError("Administrator access required");
  return user;
}
