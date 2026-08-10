import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/utils/token";

// Staff-only: return the business's single, shareable customer-registration
// link. It's REUSABLE — one common link that any number of customers can
// register through — so repeated calls hand back the SAME token rather than
// minting a new one. Only created the first time (or if none exists yet).
export const POST = handler(async (_req: NextRequest) => {
  const { id: userId, businessId } = await requireBusiness();

  let invite = await prisma.customerInvite.findFirst({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });

  if (!invite) {
    // No expiry (expiresAt = null) — the link never lapses, and the public
    // route never consumes it, so it stays valid for every customer.
    invite = await prisma.customerInvite.create({
      data: { token: generateToken(), expiresAt: null, businessId, createdById: userId },
      select: { token: true },
    });
  }

  // The client builds the absolute URL from window.location.origin.
  return ok({ token: invite.token, expiresAt: null }, 201);
});
