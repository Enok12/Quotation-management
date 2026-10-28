import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { codService } from "@/server/services/cod.service";
import { codConfirmSchema } from "@/lib/validation/cod.schema";

type Ctx = { params: Promise<{ token: string }> };

// PUBLIC (no login): the customer's answer from their WhatsApp confirmation
// link. The 256-bit token is the only credential, and it only acts on an order
// still awaiting confirmation (see codService.answerConfirmation). Listed in
// the public matcher in src/middleware.ts.
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const { token } = await params;
  const body = codConfirmSchema.parse(await req.json());
  return ok(await codService.answerConfirmation(token, body));
});
