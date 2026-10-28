import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { codService } from "@/server/services/cod.service";

export const GET = handler(async () => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");
  return ok(await codService.summary(businessId));
});
