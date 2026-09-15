import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { saleService } from "@/server/services/sale.service";
import { saleCreateSchema } from "@/lib/validation/sale.schema";

export const GET = handler(async (req: NextRequest) => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");

  const { searchParams } = new URL(req.url);
  const sales = await saleService.list(businessId, {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  return ok(sales.map((s) => ({
    id: s.id,
    items: s.items.map((i) => ({
      sku: i.product.sku, productName: i.product.name, quantity: i.quantity,
      unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal),
      profit: (Number(i.unitPrice) - Number(i.costPriceAtSale)) * i.quantity,
    })),
    totalAmount: Number(s.totalAmount),
    paymentMethod: s.paymentMethod, note: s.note,
    soldBy: s.soldBy.name ?? s.soldBy.email, createdAt: s.createdAt.toISOString(),
  })));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");

  const body = saleCreateSchema.parse(await req.json());
  const sale = await saleService.create(body, userId, businessId);
  return ok({ id: sale.id }, 201);
});
