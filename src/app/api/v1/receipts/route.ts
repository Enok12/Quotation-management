import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { receiptService } from "@/server/services/receipt.service";
import { receiptCreateSchema } from "@/lib/validation/receipt.schema";
import { receiptRepository } from "@/server/repositories/receipt.repository";

export const GET = handler(async (req: NextRequest) => {
  await requireUser();
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 20)));
  const where: Prisma.ReceiptWhereInput = {
    ...(sp.get("status") ? { status: sp.get("status") as Prisma.EnumReceiptStatusFilter["equals"] } : {}),
    ...(sp.get("orderStatus") ? { orderStatus: sp.get("orderStatus") as Prisma.EnumOrderStatusFilter["equals"] } : {}),
    ...(sp.get("search") ? { custName: { contains: sp.get("search")!, mode: "insensitive" } } : {}),
  };
  const [total, items] = await receiptRepository.list({
    where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" },
  });
  return ok({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = receiptCreateSchema.parse(await req.json());
  return ok(await receiptService.create(body, user.id), 201);
});
