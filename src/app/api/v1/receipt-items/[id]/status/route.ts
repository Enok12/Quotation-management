import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { receiptService } from "@/server/services/receipt.service";
import { orderStatusSchema } from "@/lib/validation/receipt.schema";

type Ctx = { params: Promise<{ id: string }> };

// Changes a single item's production status.
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireBusiness();
  const { id } = await params;
  const body = orderStatusSchema.parse(await req.json());
  return ok(await receiptService.changeItemStatus(id, body.status, user.id, user.businessId, body.note));
});
