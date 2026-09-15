import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import { dateRangeFilter } from "@/lib/utils/date-range";
import type {
  InventoryProductCreateInput,
  InventoryProductUpdateInput,
  StockMovementInput,
} from "@/lib/validation/inventory.schema";

const D = (n: number) => new Prisma.Decimal(n);

export const inventoryService = {
  list(businessId: string, opts: { includeArchived?: boolean } = {}) {
    return prisma.inventoryProduct.findMany({
      where: { businessId, ...(opts.includeArchived ? {} : { isArchived: false }) },
      orderBy: { createdAt: "desc" },
      include: { category: { select: { id: true, name: true } } },
    });
  },

  async get(id: string, businessId: string) {
    const product = await prisma.inventoryProduct.findFirst({
      where: { id, businessId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!product) throw new NotFoundError("Product");
    return product;
  },

  /**
   * Creates a product. An opening quantity (if any) is recorded as a real
   * "Opening stock" IN movement rather than just setting quantityOnHand
   * directly — the movement log stays the single source of truth for how a
   * product's stock got to where it is.
   */
  async create(input: InventoryProductCreateInput, actorId: string, businessId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const product = await tx.inventoryProduct.create({
          data: {
            businessId,
            sku: input.sku,
            name: input.name,
            categoryId: input.categoryId,
            costPrice: D(input.costPrice),
            sellingPrice: D(input.sellingPrice),
            quantityOnHand: input.openingQuantity,
            createdById: actorId,
          },
        });
        if (input.openingQuantity > 0) {
          await tx.inventoryStockMovement.create({
            data: {
              productId: product.id, businessId, type: "IN",
              quantity: input.openingQuantity, reason: "Opening stock",
              performedById: actorId,
            },
          });
        }
        await auditService.log(tx, {
          businessId, actorId, action: "INVENTORY_PRODUCT_CREATED", entityType: "InventoryProduct", entityId: product.id,
          metadata: { sku: product.sku },
        });
        return product;
      });
    } catch (e) {
      const isDuplicate =
        typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
      if (isDuplicate) throw new ConflictError(`SKU "${input.sku}" already exists.`);
      throw e;
    }
  },

  /**
   * Edits product details only — never quantityOnHand. Stock changes must go
   * through adjustStock(), so the movement log always explains every change.
   */
  async update(id: string, input: InventoryProductUpdateInput, actorId: string, businessId: string) {
    const existing = await prisma.inventoryProduct.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError("Product");

    try {
      return await prisma.$transaction(async (tx) => {
        const updated = await tx.inventoryProduct.update({
          where: { id },
          data: {
            ...(input.sku !== undefined ? { sku: input.sku } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
            ...(input.costPrice !== undefined ? { costPrice: D(input.costPrice) } : {}),
            ...(input.sellingPrice !== undefined ? { sellingPrice: D(input.sellingPrice) } : {}),
          },
        });
        await auditService.log(tx, {
          businessId, actorId, action: "INVENTORY_PRODUCT_UPDATED", entityType: "InventoryProduct", entityId: id,
          metadata: { sku: updated.sku },
        });
        return updated;
      });
    } catch (e) {
      const isDuplicate =
        typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
      if (isDuplicate) throw new ConflictError(`SKU "${input.sku}" already exists.`);
      throw e;
    }
  },

  /** Soft delete — keeps its movement history intact. */
  async archive(id: string, actorId: string, businessId: string) {
    const existing = await prisma.inventoryProduct.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError("Product");

    return prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryProduct.update({ where: { id }, data: { isArchived: true } });
      await auditService.log(tx, {
        businessId, actorId, action: "INVENTORY_PRODUCT_ARCHIVED", entityType: "InventoryProduct", entityId: id,
        metadata: { sku: updated.sku },
      });
      return updated;
    });
  },

  /**
   * Records a stock movement and updates the running quantityOnHand total in
   * the same transaction. OUT is rejected if it would take stock below zero.
   */
  async adjustStock(productId: string, input: StockMovementInput, actorId: string, businessId: string) {
    const product = await prisma.inventoryProduct.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundError("Product");

    const delta = input.type === "OUT" ? -input.quantity : input.quantity;
    if (product.quantityOnHand + delta < 0) {
      throw new ConflictError(`Not enough stock — only ${product.quantityOnHand} on hand.`);
    }

    return prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryStockMovement.create({
        data: {
          productId, businessId, type: input.type, quantity: input.quantity,
          reason: input.reason, note: input.note, performedById: actorId,
        },
      });
      const updated = await tx.inventoryProduct.update({
        where: { id: productId },
        data: { quantityOnHand: { increment: delta } },
      });
      await auditService.log(tx, {
        businessId, actorId, action: "INVENTORY_STOCK_ADJUSTED", entityType: "InventoryProduct", entityId: productId,
        metadata: { sku: product.sku, type: input.type, quantity: input.quantity, reason: input.reason },
      });
      return { movement, product: updated };
    });
  },

  listMovements(productId: string, businessId: string) {
    return prisma.inventoryStockMovement.findMany({
      where: { productId, businessId },
      orderBy: { createdAt: "desc" },
      include: { performedBy: { select: { name: true, email: true } } },
    });
  },

  /** Every stock movement across every product — the "Stock Adjustments" page. */
  listAllMovements(businessId: string, opts: { from?: string; to?: string } = {}) {
    const dateWhere = dateRangeFilter(opts.from, opts.to);
    return prisma.inventoryStockMovement.findMany({
      where: { businessId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { sku: true, name: true } },
        performedBy: { select: { name: true, email: true } },
      },
    });
  },
};
