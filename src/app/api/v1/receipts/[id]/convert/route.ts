import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { receiptService } from "@/server/services/receipt.service";

type Ctx = { params: Promise<{ id: string }> };

// Create a new bulk order from an approved sample. The sample receipt is
// left untouched (stays in Sample Orders) — this creates a separate receipt.
export const POST = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const receipt = await receiptService.createBulkFromSample(id, user.id);
  return ok({
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    orderType: receipt.orderType,
    paymentStatus: receipt.paymentStatus,
  });
});
