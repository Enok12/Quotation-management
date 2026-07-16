import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { receiptService } from "@/server/services/receipt.service";
import { receiptCreateSchema } from "@/lib/validation/receipt.schema";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { businessId } = await requireBusiness();
  const { id } = await params;
  return ok(await receiptService.getFull(id, businessId));
});

// Editing a receipt snapshots the prior state as a new version.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireBusiness();
  const body = receiptCreateSchema.parse(await req.json());
  return ok(await receiptService.update(id, body, user.id, user.businessId));
});

// Delete a receipt (e.g. a rejected sample). Returns the number so the client
// can remove its PDF from the computer folder.
export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireBusiness();
  const { id } = await params;
  const removed = await receiptService.remove(id, user.id, user.businessId);
  return ok({ id, receiptNumber: removed.receiptNumber });
});
