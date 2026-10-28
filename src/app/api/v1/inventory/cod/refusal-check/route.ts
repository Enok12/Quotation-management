import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { codService } from "@/server/services/cod.service";

const querySchema = z.object({ phone: z.string().max(30) });

// Warning only — the sale dialog shows it and lets the seller carry on.
// Counts are always scoped to the caller's own business.
export const GET = handler(async (req: NextRequest) => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");
  const { phone } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await codService.refusalCheck(businessId, phone));
});
