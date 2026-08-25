import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { AppError } from "@/lib/api/errors";
import { patternService, patternFiles } from "@/server/services/pattern.service";
import { MAX_PATTERN_FILE_BYTES, MODULE_FILE_FIELD } from "@/lib/pattern-upload-limits";
import { patternCodeFromFileName } from "@/lib/utils/pattern-code";

// Everything here is gated on the STYLES section, which is what confines a
// Pattern Maker to this module — see ROLE_SECTIONS in lib/section-access.ts.
// Note it's requireBusiness, not requireAdmin: uploading patterns is the
// pattern maker's whole job, so this must not be admin-only.

export const GET = handler(async () => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "STYLES");

  // A Pattern Maker sees only their own uploads; Admin/Staff see everything
  // in the business so they can review what makers submitted.
  const patterns = await patternService.list(businessId, {
    onlyCreatedById: role === "PATTERN_MAKER" ? userId : undefined,
  });

  return ok(patterns.map((p) => ({
    id: p.id,
    patternCode: p.patternCode,
    status: p.status,
    description: p.description,
    imageUrl: p.imageUrl,
    files: patternFiles(p),
    createdAt: p.createdAt.toISOString(),
    createdBy: p.createdBy.name ?? p.createdBy.email,
    createdById: p.createdById,
    assignedCount: p._count.items,
  })));
});

// One module (.mdl) file per request — the bulk-upload UI POSTs each selected
// file separately (with client-side concurrency), so a large batch never hits
// a single-request size limit. The Pattern ID is derived from the file NAME;
// the pattern is created PENDING_REVIEW with no description/picture, awaiting
// an admin's review (see PATCH /patterns/[id]).
export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "STYLES");

  const form = await req.formData();

  const moduleRaw = form.get(MODULE_FILE_FIELD);
  if (!(moduleRaw instanceof File) || moduleRaw.size === 0) throw new AppError("A module file is required.", 400);
  if (moduleRaw.size > MAX_PATTERN_FILE_BYTES) throw new AppError("File is too large (max 10MB).", 400);
  const moduleFile = moduleRaw;

  const patternCode = patternCodeFromFileName(moduleFile.name);
  if (!patternCode) throw new AppError("Could not read a Pattern ID from the file name.", 400);
  if (patternCode.length > 40) throw new AppError("File name is too long for a Pattern ID (max 40 characters).", 400);

  // addRandomSuffix keeps two uploads of the same filename from overwriting
  // each other in Blob storage (the Pattern ID uniqueness is enforced separately).
  const folder = `patterns/${businessId}`;
  const moduleBlob = await put(`${folder}/${moduleFile.name}`, moduleFile, { access: "public", addRandomSuffix: true });

  // create() throws a 409 ConflictError on a duplicate Pattern ID; the client
  // marks that one file "skipped" and the rest of the batch continues.
  const pattern = await patternService.create(
    { patternCode, moduleFileUrl: moduleBlob.url, moduleFileName: moduleFile.name },
    userId,
    businessId,
  );

  return ok({ id: pattern.id, patternCode: pattern.patternCode }, 201);
});
