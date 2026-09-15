import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { inventoryCategoryService } from "@/server/services/inventory-category.service";
import { categoryCreateSchema } from "@/lib/validation/inventory-category.schema";

export const GET = handler(async () => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");

  const categories = await inventoryCategoryService.list(businessId);
  return ok(categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products })));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "INVENTORY");

  const body = categoryCreateSchema.parse(await req.json());
  const category = await inventoryCategoryService.create(body, userId, businessId);
  return ok({ id: category.id, name: category.name }, 201);
});
