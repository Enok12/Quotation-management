import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import { dateRangeFilter } from "@/lib/utils/date-range";
import type { SaleCreateInput } from "@/lib/validation/sale.schema";

const D = (n: number) => new Prisma.Decimal(n);

export const saleService = {
  /**
   * Records a sale that can cover several products (a basket) — same
   * header+lines shape as Receipt/ReceiptItem. In one transaction: creates
   * the InventorySale header + one InventorySaleItem per line, an
   * InventoryStockMovement per line (type OUT, reason "Sold") so the stock
   * ledger and the sales ledger never disagree, and decrements each
   * product's quantityOnHand.
   */
  async create(input: SaleCreateInput, actorId: string, businessId: string) {
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await prisma.inventoryProduct.findMany({ where: { id: { in: productIds }, businessId } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    if (productMap.size !== productIds.length) throw new NotFoundError("Product");

    // A product can appear on more than one line — check total requested
    // quantity per product against what's actually on hand.
    const requestedByProduct = new Map<string, number>();
    for (const item of input.items) {
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    for (const [productId, requested] of requestedByProduct) {
      const product = productMap.get(productId)!;
      if (product.quantityOnHand < requested) {
        throw new ConflictError(`Not enough stock for "${product.name}" — only ${product.quantityOnHand} on hand.`);
      }
    }

    const lines = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = item.unitPrice ?? Number(product.sellingPrice);
      return { product, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity };
    });
    const totalAmount = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    return prisma.$transaction(async (tx) => {
      const sale = await tx.inventorySale.create({
        data: {
          businessId, totalAmount: D(totalAmount),
          paymentMethod: input.paymentMethod, note: input.note, soldById: actorId,
        },
      });
      for (const line of lines) {
        await tx.inventorySaleItem.create({
          data: {
            saleId: sale.id, productId: line.product.id, quantity: line.quantity,
            unitPrice: D(line.unitPrice), costPriceAtSale: line.product.costPrice, lineTotal: D(line.lineTotal),
          },
        });
        await tx.inventoryStockMovement.create({
          data: {
            productId: line.product.id, businessId, type: "OUT", quantity: line.quantity,
            reason: "Sold", performedById: actorId,
          },
        });
      }
      for (const [productId, requested] of requestedByProduct) {
        await tx.inventoryProduct.update({ where: { id: productId }, data: { quantityOnHand: { decrement: requested } } });
      }
      await auditService.log(tx, {
        businessId, actorId, action: "INVENTORY_SALE_RECORDED", entityType: "InventorySale", entityId: sale.id,
        metadata: { itemCount: lines.length, totalAmount },
      });
      return sale;
    });
  },

  list(businessId: string, opts: { from?: string; to?: string } = {}) {
    const dateWhere = dateRangeFilter(opts.from, opts.to);
    return prisma.inventorySale.findMany({
      where: { businessId, ...(dateWhere ? { createdAt: dateWhere } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { product: { select: { sku: true, name: true } }, returns: true } },
        soldBy: { select: { name: true, email: true } },
      },
    });
  },
};
