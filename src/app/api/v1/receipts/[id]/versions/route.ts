import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { receiptService } from "@/server/services/receipt.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { businessId } = await requireBusiness();
  const { id } = await params;
  return ok(await receiptService.listVersions(id, businessId));
});
