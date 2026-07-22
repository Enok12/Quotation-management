import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { prisma } from "@/lib/db";
import { businessService } from "@/server/services/business.service";
import { AppError } from "@/lib/api/errors";
import { MAX_LOGO_BYTES, isAcceptedLogoFile } from "@/lib/logo-upload-limits";

// Admin-only: upload (or replace) the active business's logo.
export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireAdmin();
  await requireSection(businessId, role, "SETTINGS");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("No file was uploaded.", 400);
  if (!isAcceptedLogoFile(file)) throw new AppError("Please upload a PNG or JPEG image.", 400);
  if (file.size > MAX_LOGO_BYTES) throw new AppError("Logo is too large (max 3MB).", 400);

  const existing = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { logoUrl: true } });

  const ext = file.type === "image/png" ? "png" : "jpg";
  const blob = await put(`business-logos/${businessId}-${Date.now()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  const business = await businessService.setLogo(businessId, userId, blob.url);

  // Best-effort cleanup of the previous logo blob — this shouldn't block the
  // already-successful update if it fails.
  if (existing.logoUrl) await del(existing.logoUrl).catch(() => {});

  return ok({ logoUrl: business.logoUrl });
});

// Admin-only: remove the current logo (falls back to the default MONTRA mark).
export const DELETE = handler(async () => {
  const { id: userId, businessId, role } = await requireAdmin();
  await requireSection(businessId, role, "SETTINGS");
  const existing = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { logoUrl: true } });
  const business = await businessService.setLogo(businessId, userId, null);
  if (existing.logoUrl) await del(existing.logoUrl).catch(() => {});
  return ok({ logoUrl: business.logoUrl });
});
