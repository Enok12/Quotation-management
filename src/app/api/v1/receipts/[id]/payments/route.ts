import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { receiptService } from "@/server/services/receipt.service";

type Ctx = { params: Promise<{ id: string }> };

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
});

// Record an instalment against a finalized receipt.
export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireBusiness();
  const { id } = await params;
  const input = paymentSchema.parse(await req.json());
  const receipt = await receiptService.recordPayment(id, input, user.id, user.businessId);
  return ok({
    id: receipt.id, paymentStatus: receipt.paymentStatus, balance: receipt.balance,
    receiptNumber: receipt.receiptNumber, category: receipt.category,
  }, 201);
});
