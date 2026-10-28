import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { saleService } from "@/server/services/sale.service";
import { saleCreateSchema } from "@/lib/validation/sale.schema";
import { codService } from "@/server/services/cod.service";
import { codSaleCreateSchema } from "@/lib/validation/cod.schema";

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
    items: s.items.map((i) => {
      const returnedQuantity = i.returns.reduce((sum, r) => sum + r.quantity, 0);
      return {
        id: i.id, sku: i.product.sku, productName: i.product.name, quantity: i.quantity,
        unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal),
        profit: (Number(i.unitPrice) - Number(i.costPriceAtSale)) * i.quantity,
        returnedQuantity, returnable: i.quantity - returnedQuantity,
      };
    }),
    totalAmount: Number(s.totalAmount),
    paymentMethod: s.paymentMethod, note: s.note,
    soldBy: s.soldBy.name ?? s.soldBy.email,
    // A COD sale is dated by its delivery (that's when it became revenue).
    createdAt: (s.delivery?.deliveredAt ?? s.createdAt).toISOString(),
    cod: s.delivery
      ? { dispatchRef: s.delivery.dispatchRef, status: s.delivery.status, deliveryCost: s.delivery.feePaidBy === "BUSINESS" ? Number(s.delivery.deliveryFee) : 0 }
      : null,
  })));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");

  const raw = await req.json();

  // Cash-on-Delivery sale: reserves stock, numbers it COD-0001…, and starts in
  // PENDING_CONFIRMATION (or PENDING_DISPATCH when the seller already has the
  // details). Everything else is the original immediate in-store sale below.
  if (raw?.fulfilment === "COD_DELIVERY") {
    const codBody = codSaleCreateSchema.parse(raw);
    const cod = await codService.create(codBody, userId, businessId);
    return ok(cod, 201);
  }

  const body = saleCreateSchema.parse(raw);
  const sale = await saleService.create(body, userId, businessId);
  return ok({ id: sale.id }, 201);
});
