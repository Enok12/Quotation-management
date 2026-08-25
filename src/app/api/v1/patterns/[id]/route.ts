import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness, requireAdmin } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { AppError } from "@/lib/api/errors";
import { patternService } from "@/server/services/pattern.service";
import { MAX_PATTERN_FILE_BYTES, isAcceptedPatternImage } from "@/lib/pattern-upload-limits";

type Ctx = { params: Promise<{ id: string }> };

// Admin review/finalize (and edit of an already-finalized pattern): attach a
// description (required) and an optional picture, then mark FINALIZED so it
// becomes assignable. Admin-only.
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id: actorId, businessId, role } = await requireAdmin();
  await requireSection(businessId, role, "STYLES");
  const { id } = await params;

  const form = await req.formData();

  const description = String(form.get("description") ?? "").trim();
  if (!description) throw new AppError("A description is required to finalize.", 400);
  if (description.length > 500) throw new AppError("Description is too long (max 500 characters).", 400);

  const pictureRaw = form.get("picture");
  const picture = pictureRaw instanceof File && pictureRaw.size > 0 ? pictureRaw : null;
  if (picture) {
    if (!isAcceptedPatternImage(picture)) throw new AppError("The picture must be an image.", 400);
    if (picture.size > MAX_PATTERN_FILE_BYTES) throw new AppError("The picture is too large (max 10MB).", 400);
  }

  const imageUrl = picture
    ? (await put(`patterns/${businessId}/picture-${Date.now()}`, picture, { access: "public", addRandomSuffix: true })).url
    : undefined;

  const pattern = await patternService.finalize(id, { description, imageUrl }, actorId, businessId);
  return ok({ id: pattern.id, status: pattern.status });
});

// Delete a pattern. A Pattern Maker may delete only their own pending upload;
// an Admin may delete any (the service enforces this). requireBusiness (not
// requireAdmin) so a pattern maker can remove a wrong file they just uploaded.
export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id: actorId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "STYLES");
  const { id } = await params;

  const { moduleFileUrl, imageUrl } = await patternService.remove(id, actorId, businessId, role);

  // Best-effort Blob cleanup — mustn't fail the already-successful delete.
  await Promise.all([
    moduleFileUrl ? del(moduleFileUrl).catch(() => {}) : null,
    imageUrl ? del(imageUrl).catch(() => {}) : null,
  ]);

  return ok({ id });
});
