import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { inventoryCategoryService } from "@/server/services/inventory-category.service";
import { categoryUpdateSchema } from "@/lib/validation/inventory-category.schema";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");
  const { id } = await params;

  const body = categoryUpdateSchema.parse(await req.json());
  const category = await inventoryCategoryService.update(id, body, userId, businessId);
  return ok({ id: category.id, name: category.name });
});

export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");
  const { id } = await params;

  await inventoryCategoryService.remove(id, userId, businessId);
  return ok({ id });
});
