import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import { dateRangeFilter } from "@/lib/utils/date-range";
import type { ReturnCreateInput } from "@/lib/validation/return.schema";

const D = (n: number) => new Prisma.Decimal(n);

export const returnService = {
  /**
   * Processes a (partial or full) return against one sale line. Never
   * mutates the original InventorySaleItem — the sale's historical record
   * stays exactly as recorded; this is its own ledger. In one transaction:
   * creates the InventoryReturn row, an InventoryStockMovement (type IN,
   * reason "Returned") to restock, and increments quantityOnHand.
   */
  async create(input: ReturnCreateInput, actorId: string, businessId: string) {
    const saleItem = await prisma.inventorySaleItem.findFirst({
      where: { id: input.saleItemId, sale: { businessId } },
      include: { product: true, returns: true },
    });
    if (!saleItem) throw new NotFoundError("Sale item");

    const alreadyReturned = saleItem.returns.reduce((sum, r) => sum + r.quantity, 0);
    const returnable = saleItem.quantity - alreadyReturned;
    if (input.quantity > returnable) {
      throw new ConflictError(`Only ${returnable} unit(s) of this line can still be returned.`);
    }

    const refundAmount = input.refundAmount ?? Number(saleItem.unitPrice) * input.quantity;

    return prisma.$transaction(async (tx) => {
      const ret = await tx.inventoryReturn.create({
        data: {
          businessId, saleItemId: saleItem.id, productId: saleItem.productId,
          quantity: input.quantity, refundAmount: D(refundAmount),
          reason: input.reason, note: input.note, processedById: actorId,
        },
      });
      await tx.inventoryStockMovement.create({
        data: {
          productId: saleItem.productId, businessId, type: "IN", quantity: input.quantity,
          reason: "Returned", performedById: actorId,
        },
      });
      await tx.inventoryProduct.update({
        where: { id: saleItem.productId },
        data: { quantityOnHand: { increment: input.quantity } },
      });
      await auditService.log(tx, {
        businessId, actorId, action: "INVENTORY_RETURN_PROCESSED", entityType: "InventoryReturn", entityId: ret.id,
        metadata: { sku: saleItem.product.sku, quantity: input.quantity, refundAmount },
      });
      return ret;
    });
  },

  list(businessId: string, opts: { from?: string; to?: string } = {}) {
    const dateWhere = dateRangeFilter(opts.from, opts.to);
    return prisma.inventoryReturn.findMany({
      where: { businessId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { sku: true, name: true } },
        processedBy: { select: { name: true, email: true } },
      },
    });
  },
};
