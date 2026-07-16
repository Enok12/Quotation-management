import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { staffInviteService } from "@/server/services/staff-invite.service";

const bodySchema = z.object({ token: z.string().min(1) });

// Any signed-in user can redeem an invite link — it joins them to that
// business (as the invite's role) and switches their active business to it.
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { token } = bodySchema.parse(await req.json());
  const { business, role } = await staffInviteService.redeem(token, user.id);
  return ok({ businessName: business.name, role });
});
