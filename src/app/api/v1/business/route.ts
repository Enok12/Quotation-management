import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { businessService } from "@/server/services/business.service";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  // An empty string clears the address (turning notifications off) rather
  // than failing validation, so the field can simply be emptied in the UI.
  notificationEmail: z
    .union([z.string().trim().email(), z.literal("")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "" ? null : v)),
});

// Admin-only: update the active business's details.
export const PUT = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireAdmin();
  await requireSection(businessId, role, "SETTINGS");
  const { name, notificationEmail } = bodySchema.parse(await req.json());
  const business = await businessService.updateDetails(businessId, userId, { name, notificationEmail });
  return ok({ id: business.id, name: business.name, notificationEmail: business.notificationEmail });
});
