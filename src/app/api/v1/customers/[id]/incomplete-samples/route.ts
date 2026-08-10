import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { receiptNumberLabelOr } from "@/lib/utils/receipt-number";

type Ctx = { params: Promise<{ id: string }> };

// Powers the "you have an open sample" prompt shown before creating a new
// receipt for a customer. A sample is still OPEN until it's been converted to
// a bulk order (convertedToBulkId is null). Once converted, it's considered
// handled and never appears here — regardless of its payment/production state.
// This catches both "you have an unfinished sample" and "you finished a sample
// but never converted it."
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { businessId } = await requireBusiness();
  const { id } = await params;

  const samples = await prisma.receipt.findMany({
    where: {
      customerId: id,
      businessId,
      orderType: "SAMPLE",
      status: "FINALIZED",
      convertedToBulkId: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, receiptNumber: true, orderType: true, paymentStatus: true, orderStatus: true },
  });

  return ok(
    samples.map((s) => {
      // Reason adapts to why it's still open: unfinished vs. done-but-unconverted.
      const reasons: string[] = [];
      if (s.paymentStatus !== "PAID") reasons.push("Payment pending");
      if (s.orderStatus !== "COMPLETED") reasons.push("In production");
      if (reasons.length === 0) reasons.push("Ready to convert to bulk");
      return {
        id: s.id,
        label: receiptNumberLabelOr(s.receiptNumber, s.orderType),
        reason: reasons.join(" · "),
      };
    }),
  );
});
