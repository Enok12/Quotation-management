import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { receiptService } from "@/server/services/receipt.service";
import { receiptCreateSchema } from "@/lib/validation/receipt.schema";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  return ok(await receiptService.getFull(id));
});

// Editing a receipt snapshots the prior state as a new version.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const user = await requireUser();
  const body = receiptCreateSchema.parse(await req.json());
  return ok(await receiptService.update(id, body, user.id));
});

// Delete a receipt (e.g. a rejected sample). Returns the number so the client
// can remove its PDF from the computer folder.
export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const removed = await receiptService.remove(id, user.id);
  return ok({ id, receiptNumber: removed.receiptNumber });
});
