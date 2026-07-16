import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { businessService } from "@/server/services/business.service";

const bodySchema = z.object({ name: z.string().trim().min(2).max(120) });

// Admin-only: rename the active business.
export const PUT = handler(async (req: NextRequest) => {
  const { id: userId, businessId } = await requireAdmin();
  const { name } = bodySchema.parse(await req.json());
  const business = await businessService.updateName(businessId, userId, name);
  return ok({ id: business.id, name: business.name });
});
