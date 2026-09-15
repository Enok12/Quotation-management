import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { inventoryService } from "@/server/services/inventory.service";
import { inventoryProductUpdateSchema } from "@/lib/validation/inventory.schema";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");
  const { id } = await params;

  const body = inventoryProductUpdateSchema.parse(await req.json());
  const product = await inventoryService.update(id, body, userId, businessId);
  return ok({ id: product.id, sku: product.sku });
});

// Soft delete (archive) — keeps the product's stock-movement history intact.
export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");
  const { id } = await params;

  await inventoryService.archive(id, userId, businessId);
  return ok({ id });
});
