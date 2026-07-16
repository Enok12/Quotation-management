import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/utils/token";

// Invite links are valid for 48 hours from generation (and single-use).
const EXPIRY_MS = 48 * 60 * 60 * 1000;

// Staff-only: mint a fresh one-time registration link for a customer.
export const POST = handler(async (_req: NextRequest) => {
  const { id: userId, businessId } = await requireBusiness();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + EXPIRY_MS);
  await prisma.customerInvite.create({
    data: { token, expiresAt, businessId, createdById: userId },
  });

  // The client builds the absolute URL from window.location.origin.
  return ok({ token, expiresAt }, 201);
});
