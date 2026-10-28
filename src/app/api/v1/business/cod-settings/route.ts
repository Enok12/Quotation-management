import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { businessService } from "@/server/services/business.service";
import { codSettingsSchema } from "@/lib/validation/cod.schema";

// Admin-only: turn Retail Cash-on-Delivery on/off and set the refusal-warning threshold.
// Gated on SALES (not SETTINGS) on purpose: a retail-only plan has no Settings
// section, and COD must still be switchable by its admin — from the Sales and
// COD Orders pages as well as Settings.
export const PUT = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireAdmin();
  await requireSection(businessId, role, "SALES");
  const body = codSettingsSchema.parse(await req.json());
  const business = await businessService.updateCodSettings(businessId, userId, body);
  return ok({ codEnabled: business.codEnabled, codRefusalWarnThreshold: business.codRefusalWarnThreshold });
});
