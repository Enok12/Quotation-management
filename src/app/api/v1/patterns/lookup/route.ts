import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { patternService } from "@/server/services/pattern.service";

// Resolve a typed-in Pattern ID for the Assign Pattern dialog.
//
// Gated on PRODUCTION (not STYLES): this exists to serve the assignment flow
// on the Production page, so a Pattern Maker — who has neither PRODUCTION nor
// any business seeing other people's patterns — can't use it to enumerate
// patterns they didn't upload.
//
// A miss returns 200 with found:false rather than 404. The dialog needs to
// render "no pattern with that ID" as an ordinary state while someone is
// still typing, not treat it as a request failure.
export const GET = handler(async (req: NextRequest) => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "PRODUCTION");

  const code = new URL(req.url).searchParams.get("code") ?? "";
  const pattern = await patternService.findByCode(code, businessId);
  if (!pattern) return ok({ found: false });

  return ok({
    found: true,
    pattern: {
      id: pattern.id,
      patternCode: pattern.patternCode,
      description: pattern.description,
      imageUrl: pattern.imageUrl,
      files: [
        { url: pattern.file1Url, name: pattern.file1Name },
        { url: pattern.file2Url, name: pattern.file2Name },
        { url: pattern.file3Url, name: pattern.file3Name },
      ],
      createdBy: pattern.createdBy.name ?? pattern.createdBy.email,
      createdAt: pattern.createdAt.toISOString(),
    },
  });
});
