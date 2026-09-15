import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { inventoryService } from "@/server/services/inventory.service";
import { stockMovementSchema } from "@/lib/validation/inventory.schema";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");
  const { id } = await params;

  const movements = await inventoryService.listMovements(id, businessId);
  return ok(movements.map((m) => ({
    id: m.id, type: m.type, quantity: m.quantity, reason: m.reason, note: m.note,
    performedBy: m.performedBy.name ?? m.performedBy.email,
    createdAt: m.createdAt.toISOString(),
  })));
});

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");
  const { id } = await params;

  const body = stockMovementSchema.parse(await req.json());
  const { product } = await inventoryService.adjustStock(id, body, userId, businessId);
  return ok({ id: product.id, quantityOnHand: product.quantityOnHand }, 201);
});
