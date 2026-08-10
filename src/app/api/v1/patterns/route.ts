import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { AppError } from "@/lib/api/errors";
import { patternService, patternFiles } from "@/server/services/pattern.service";
import {
  MAX_PATTERN_FILE_BYTES,
  isAcceptedPatternImage,
  MODULE_FILE_FIELD,
} from "@/lib/pattern-upload-limits";
import { normalizePatternCode } from "@/lib/utils/pattern-code";

// Everything here is gated on the STYLES section, which is what confines a
// Pattern Maker to this module — see ROLE_SECTIONS in lib/section-access.ts.
// Note it's requireBusiness, not requireAdmin: uploading patterns is the
// pattern maker's whole job, so this must not be admin-only.

export const GET = handler(async () => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "STYLES");

  // A Pattern Maker sees only their own uploads; Admin/Staff see everything
  // in the business so they can review what contractors submitted.
  const patterns = await patternService.list(businessId, {
    onlyCreatedById: role === "PATTERN_MAKER" ? userId : undefined,
  });

  return ok(patterns.map((p) => ({
    id: p.id,
    patternCode: p.patternCode,
    description: p.description,
    imageUrl: p.imageUrl,
    files: patternFiles(p),
    createdAt: p.createdAt.toISOString(),
    createdBy: p.createdBy.name ?? p.createdBy.email,
    assignedCount: p._count.items,
  })));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "STYLES");

  const form = await req.formData();

  // Pattern ID — entered by the pattern maker, normalized so uniqueness and
  // lookups are case/whitespace-insensitive.
  const patternCode = normalizePatternCode(String(form.get("patternCode") ?? ""));
  if (!patternCode) throw new AppError("A Pattern ID is required.", 400);
  if (patternCode.length > 40) throw new AppError("Pattern ID is too long (max 40 characters).", 400);

  const description = String(form.get("description") ?? "").trim();
  if (!description) throw new AppError("An item description is required.", 400);
  if (description.length > 500) throw new AppError("Description is too long (max 500 characters).", 400);

  // The Module file is required. Validate BEFORE uploading anything.
  const moduleRaw = form.get(MODULE_FILE_FIELD);
  if (!(moduleRaw instanceof File) || moduleRaw.size === 0) throw new AppError("The Module file is required.", 400);
  if (moduleRaw.size > MAX_PATTERN_FILE_BYTES) throw new AppError("The Module file is too large (max 10MB).", 400);
  const moduleFile = moduleRaw;

  const pictureRaw = form.get("picture");
  const picture = pictureRaw instanceof File && pictureRaw.size > 0 ? pictureRaw : null;
  if (picture) {
    if (!isAcceptedPatternImage(picture)) throw new AppError("The picture must be an image.", 400);
    if (picture.size > MAX_PATTERN_FILE_BYTES) throw new AppError("The picture is too large (max 10MB).", 400);
  }

  // addRandomSuffix keeps two uploads of the same filename from overwriting
  // each other — unlike the business logo, which is deliberately one-per-business.
  const folder = `patterns/${businessId}`;
  const [pictureBlob, moduleBlob] = await Promise.all([
    picture ? put(`${folder}/picture-${Date.now()}`, picture, { access: "public", addRandomSuffix: true }) : null,
    put(`${folder}/${moduleFile.name}`, moduleFile, { access: "public", addRandomSuffix: true }),
  ]);

  const pattern = await patternService.create(
    {
      patternCode,
      description,
      imageUrl: pictureBlob?.url ?? null,
      moduleFileUrl: moduleBlob.url,
      moduleFileName: moduleFile.name,
    },
    userId,
    businessId,
  );

  return ok({ id: pattern.id, patternCode: pattern.patternCode }, 201);
});
