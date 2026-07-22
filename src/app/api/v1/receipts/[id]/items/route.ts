import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// Lightweight, on-demand fetch for the Production list's expandable rows —
// just enough to show and change each item's status, not the full receipt.
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { businessId } = await requireBusiness();
  const { id } = await params;
  const items = await prisma.receiptItem.findMany({
    where: { receiptId: id, receipt: { businessId } },
    orderBy: { sortOrder: "asc" },
    // The assigned pattern's code comes along so the Production row can show
    // it inline (and prefill "Remove current") without a second round trip.
    select: {
      id: true, description: true, orderStatus: true,
      pattern: { select: { patternCode: true } },
    },
  });
  return ok(items.map((it) => ({
    id: it.id,
    description: it.description,
    orderStatus: it.orderStatus,
    patternCode: it.pattern?.patternCode ?? null,
  })));
});
