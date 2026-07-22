import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireAdmin } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { patternService } from "@/server/services/pattern.service";

type Ctx = { params: Promise<{ id: string }> };

// null clears the assignment; a string assigns that pattern.
const bodySchema = z.object({ patternId: z.string().min(1).nullable() });

// Admin-only: assigning a style to a production item is a business decision,
// not something a pattern maker (or general staff) does.
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id: actorId, businessId, role } = await requireAdmin();
  await requireSection(businessId, role, "PRODUCTION");
  const { id } = await params;
  const { patternId } = bodySchema.parse(await req.json());

  const item = await patternService.assignToItem(id, patternId, actorId, businessId);
  return ok({ id: item.id, patternId: item.patternId });
});
