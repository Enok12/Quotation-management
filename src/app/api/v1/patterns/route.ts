import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { AppError } from "@/lib/api/errors";
import { patternService } from "@/server/services/pattern.service";
import {
  MAX_PATTERN_FILE_BYTES,
  isAcceptedPatternImage,
  PATTERN_FILE_SLOTS,
} from "@/lib/pattern-upload-limits";

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
    files: [
      { url: p.file1Url, name: p.file1Name },
      { url: p.file2Url, name: p.file2Name },
      { url: p.file3Url, name: p.file3Name },
    ],
    createdAt: p.createdAt.toISOString(),
    createdBy: p.createdBy.name ?? p.createdBy.email,
    assignedCount: p._count.items,
  })));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "STYLES");

  const form = await req.formData();

  const description = String(form.get("description") ?? "").trim();
  if (!description) throw new AppError("An item description is required.", 400);
  if (description.length > 500) throw new AppError("Description is too long (max 500 characters).", 400);

  // Validate every file BEFORE uploading any of them — otherwise a rejection
  // on file 3 would leave files 1 and 2 orphaned in Blob storage, paid for
  // and unreferenced by any row.
  const files = PATTERN_FILE_SLOTS.map((slot, i) => {
    const f = form.get(slot);
    if (!(f instanceof File) || f.size === 0) throw new AppError(`File ${i + 1} is required.`, 400);
    if (f.size > MAX_PATTERN_FILE_BYTES) throw new AppError(`File ${i + 1} is too large (max 10MB).`, 400);
    return f;
  });

  const pictureRaw = form.get("picture");
  const picture = pictureRaw instanceof File && pictureRaw.size > 0 ? pictureRaw : null;
  if (picture) {
    if (!isAcceptedPatternImage(picture)) throw new AppError("The picture must be an image.", 400);
    if (picture.size > MAX_PATTERN_FILE_BYTES) throw new AppError("The picture is too large (max 10MB).", 400);
  }

  // addRandomSuffix keeps two uploads of the same filename from overwriting
  // each other — unlike the business logo, which is deliberately one-per-business.
  const folder = `patterns/${businessId}`;
  const [pictureBlob, f1, f2, f3] = await Promise.all([
    picture ? put(`${folder}/picture-${Date.now()}`, picture, { access: "public", addRandomSuffix: true }) : null,
    put(`${folder}/${files[0].name}`, files[0], { access: "public", addRandomSuffix: true }),
    put(`${folder}/${files[1].name}`, files[1], { access: "public", addRandomSuffix: true }),
    put(`${folder}/${files[2].name}`, files[2], { access: "public", addRandomSuffix: true }),
  ]);

  const pattern = await patternService.create(
    {
      description,
      imageUrl: pictureBlob?.url ?? null,
      file1Url: f1.url, file1Name: files[0].name,
      file2Url: f2.url, file2Name: files[1].name,
      file3Url: f3.url, file3Name: files[2].name,
    },
    userId,
    businessId,
  );

  return ok({ id: pattern.id, patternCode: pattern.patternCode }, 201);
});
