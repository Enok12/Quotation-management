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

  const description = String(form.get("description") ?? "").trim();
  if (!description) throw new AppError("An item description is required.", 400);
  if (description.length > 500) throw new AppError("Description is too long (max 500 characters).", 400);

  // Files are OPTIONAL — a pattern maker may save with some, or none (the form
  // warns them first). Collect only the slots that actually have a file, and
  // validate size BEFORE uploading any, so a too-large file on one slot can't
  // leave earlier uploads orphaned in Blob storage.
  const provided = PATTERN_FILE_SLOTS.map((slot) => {
    const f = form.get(slot.field);
    if (!(f instanceof File) || f.size === 0) return { slot, file: null as File | null };
    if (f.size > MAX_PATTERN_FILE_BYTES) throw new AppError(`${slot.label} file is too large (max 10MB).`, 400);
    return { slot, file: f };
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
  const [pictureBlob, ...uploaded] = await Promise.all([
    picture ? put(`${folder}/picture-${Date.now()}`, picture, { access: "public", addRandomSuffix: true }) : null,
    ...provided.map(({ file }) =>
      file ? put(`${folder}/${file.name}`, file, { access: "public", addRandomSuffix: true }) : null,
    ),
  ]);

  // uploaded[] aligns 1:1 with provided[] / PATTERN_FILE_SLOTS order.
  const [f1, f2, f3] = uploaded;
  const pattern = await patternService.create(
    {
      description,
      imageUrl: pictureBlob?.url ?? null,
      file1Url: f1?.url ?? null, file1Name: provided[0].file?.name ?? null,
      file2Url: f2?.url ?? null, file2Name: provided[1].file?.name ?? null,
      file3Url: f3?.url ?? null, file3Name: provided[2].file?.name ?? null,
    },
    userId,
    businessId,
  );

  return ok({ id: pattern.id, patternCode: pattern.patternCode }, 201);
});
