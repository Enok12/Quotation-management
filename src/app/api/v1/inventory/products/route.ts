import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { inventoryService } from "@/server/services/inventory.service";
import { inventoryProductCreateSchema } from "@/lib/validation/inventory.schema";

export const GET = handler(async () => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");

  const products = await inventoryService.list(businessId);
  return ok(products.map((p) => ({
    id: p.id, sku: p.sku, name: p.name, category: p.category,
    costPrice: Number(p.costPrice), sellingPrice: Number(p.sellingPrice),
    quantityOnHand: p.quantityOnHand, createdAt: p.createdAt.toISOString(),
  })));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");

  const body = inventoryProductCreateSchema.parse(await req.json());
  const product = await inventoryService.create(body, userId, businessId);
  return ok({ id: product.id, sku: product.sku }, 201);
});
