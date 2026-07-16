import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { businessService } from "@/server/services/business.service";
import { AppError } from "@/lib/api/errors";

const bodySchema = z.object({ apiKey: z.string().trim().min(10).max(200) });

// A cheap, no-quota-cost call — lists models rather than generating content —
// just to confirm the key is live before we save it. Catches copy-paste typos
// immediately instead of failing silently on the next receipt upload.
async function verifyGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    return res.ok;
  } catch {
    return false;
  }
}

// Admin-only: set the active business's own Gemini API key for receipt-photo
// OCR import, so its usage draws from its own quota instead of the shared
// default key's.
export const PUT = handler(async (req: NextRequest) => {
  const { id: userId, businessId } = await requireAdmin();
  const { apiKey } = bodySchema.parse(await req.json());

  if (!(await verifyGeminiKey(apiKey))) {
    throw new AppError("That API key doesn't seem to work. Double-check it and try again.", 400);
  }

  await businessService.setGeminiApiKey(businessId, userId, apiKey);
  return ok({ hasCustomApiKey: true });
});

// Admin-only: remove the business's own key — falls back to the shared default.
export const DELETE = handler(async () => {
  const { id: userId, businessId } = await requireAdmin();
  await businessService.setGeminiApiKey(businessId, userId, null);
  return ok({ hasCustomApiKey: false });
});
