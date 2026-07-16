import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { staffInviteService } from "@/server/services/staff-invite.service";

type Ctx = { params: Promise<{ id: string }> };

// Admin-only: revoke a not-yet-used invite.
export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id: userId, businessId } = await requireAdmin();
  const { id } = await params;
  const result = await staffInviteService.revoke(id, businessId, userId);
  return ok(result);
});
