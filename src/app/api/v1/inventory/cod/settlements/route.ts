import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { codService } from "@/server/services/cod.service";
import { codSettlementSchema } from "@/lib/validation/cod.schema";

// Admin-only: recording that a courier paid us out marks cash as received.
export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireAdmin();
  await requireSection(businessId, role, "SALES");
  const body = codSettlementSchema.parse(await req.json());
  return ok(await codService.settle(body, userId, businessId), 201);
});
