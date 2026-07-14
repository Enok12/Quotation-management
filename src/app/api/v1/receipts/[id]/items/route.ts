import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// Lightweight, on-demand fetch for the Production list's expandable rows —
// just enough to show and change each item's status, not the full receipt.
export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const items = await prisma.receiptItem.findMany({
    where: { receiptId: id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, description: true, orderStatus: true },
  });
  return ok(items);
});
