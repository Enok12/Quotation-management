import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import type { CategoryCreateInput } from "@/lib/validation/inventory-category.schema";

export const inventoryCategoryService = {
  list(businessId: string) {
    return prisma.inventoryCategory.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
  },

  async create(input: CategoryCreateInput, actorId: string, businessId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const category = await tx.inventoryCategory.create({ data: { businessId, name: input.name } });
        await auditService.log(tx, {
          businessId, actorId, action: "INVENTORY_CATEGORY_CREATED", entityType: "InventoryCategory", entityId: category.id,
          metadata: { name: category.name },
        });
        return category;
      });
    } catch (e) {
      const isDuplicate =
        typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
      if (isDuplicate) throw new ConflictError(`Category "${input.name}" already exists.`);
      throw e;
    }
  },

  async update(id: string, input: CategoryCreateInput, actorId: string, businessId: string) {
    const existing = await prisma.inventoryCategory.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError("Category");

    try {
      return await prisma.$transaction(async (tx) => {
        const updated = await tx.inventoryCategory.update({ where: { id }, data: { name: input.name } });
        await auditService.log(tx, {
          businessId, actorId, action: "INVENTORY_CATEGORY_UPDATED", entityType: "InventoryCategory", entityId: id,
          metadata: { name: updated.name },
        });
        return updated;
      });
    } catch (e) {
      const isDuplicate =
        typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
      if (isDuplicate) throw new ConflictError(`Category "${input.name}" already exists.`);
      throw e;
    }
  },

  /** Deleting a category just clears it off any products that used it (onDelete: SetNull) — never blocked. */
  async remove(id: string, actorId: string, businessId: string) {
    const existing = await prisma.inventoryCategory.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError("Category");

    await prisma.$transaction(async (tx) => {
      await tx.inventoryCategory.delete({ where: { id } });
      await auditService.log(tx, {
        businessId, actorId, action: "INVENTORY_CATEGORY_DELETED", entityType: "InventoryCategory", entityId: id,
        metadata: { name: existing.name },
      });
    });
    return { id };
  },
};
