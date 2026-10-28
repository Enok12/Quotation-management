import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { codService } from "@/server/services/cod.service";
import { codActionSchema } from "@/lib/validation/cod.schema";

type Ctx = { params: Promise<{ id: string }> };

// Status changes for one COD order: confirm / dispatch / deliver / refuse / cancel.
// Every transition is a guarded, audited, single-transaction update (see codService.transition).
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");
  const { id } = await params;

  const body = codActionSchema.parse(await req.json());
  await codService.transition(id, body, userId, businessId);
  return ok({ id });
});
