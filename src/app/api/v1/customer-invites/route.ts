import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/utils/token";

// Staff-only: mint a fresh one-time registration link for a customer.
export const POST = handler(async (_req: NextRequest) => {
  const { id: userId, businessId } = await requireBusiness();

  const token = generateToken();
  // No expiry for now (expiresAt = null). The public submission route treats a
  // null expiry as "never expires", so the link stays valid until it's used —
  // it remains single-use, just not time-limited. (Set a date here to
  // reinstate a time limit.)
  await prisma.customerInvite.create({
    data: { token, expiresAt: null, businessId, createdById: userId },
  });

  // The client builds the absolute URL from window.location.origin.
  return ok({ token, expiresAt: null }, 201);
});
