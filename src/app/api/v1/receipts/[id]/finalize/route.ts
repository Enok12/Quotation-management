import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { receiptService } from "@/server/services/receipt.service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  return ok(await receiptService.finalize(id, user.id));
});
