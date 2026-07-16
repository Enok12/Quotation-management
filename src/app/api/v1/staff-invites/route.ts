import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { staffInviteService } from "@/server/services/staff-invite.service";

const bodySchema = z.object({ role: z.enum(["ADMIN", "STAFF"]) });

// Admin-only: list pending/past invites for the active business.
export const GET = handler(async () => {
  const { businessId } = await requireAdmin();
  return ok(await staffInviteService.list(businessId));
});

// Admin-only: mint a fresh 48h, single-use staff invite link.
export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId } = await requireAdmin();
  const { role } = bodySchema.parse(await req.json());
  const invite = await staffInviteService.create(businessId, userId, role);
  return ok({ token: invite.token, role: invite.role, expiresAt: invite.expiresAt }, 201);
});
