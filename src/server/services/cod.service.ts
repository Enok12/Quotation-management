import { Prisma, type CodStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, ConflictError, ForbiddenError } from "@/lib/api/errors";
import { generateToken } from "@/lib/utils/token";
import { normalizePhone } from "@/lib/utils/phone";
import { auditService } from "./audit.service";
import type {
  CodSaleCreateInput, CodActionInput, CodSettlementInput, CodConfirmInput,
} from "@/lib/validation/cod.schema";

const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);
type Tx = Prisma.TransactionClient;

// How long a customer confirmation link stays usable.
const CONFIRM_LINK_TTL_MS = 3 * 24 * 60 * 60 * 1000;
// Decimal(12,2) ceiling — anything above would overflow the column.
const MAX_AMOUNT = D("9999999999.99");

// A COD sale only counts toward Sales revenue/profit from these states.
export const RECOGNISED_COD_STATUSES: CodStatus[] = ["DELIVERED", "REMITTED"];

const STALE = "This order was just changed by someone else — refresh and try again.";

/**
 * Moves one delivery from one of `from` to `data.status` with a conditional
 * update, so a double click / second tab / concurrent request can never apply
 * a transition twice. Everything COD does to stock is gated behind this.
 */
async function moveStatus(
  tx: Tx, saleId: string, businessId: string, from: CodStatus[], data: Prisma.InventorySaleDeliveryUpdateManyMutationInput,
) {
  const res = await tx.inventorySaleDelivery.updateMany({
    where: { saleId, businessId, status: { in: from } },
    data,
  });
  if (res.count !== 1) throw new ConflictError(STALE);
}

/** Puts a sale's reserved stock back (refused / cancelled / declined). Call only after moveStatus succeeded. */
async function restoreStock(tx: Tx, saleId: string, businessId: string, actorId: string, reason: string) {
  const items = await tx.inventorySaleItem.findMany({ where: { saleId }, select: { productId: true, quantity: true } });
  const byProduct = new Map<string, number>();
  for (const i of items) byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + i.quantity);
  for (const [productId, quantity] of byProduct) {
    await tx.inventoryStockMovement.create({
      data: { productId, businessId, type: "IN", quantity, reason, performedById: actorId },
    });
    await tx.inventoryProduct.updateMany({ where: { id: productId, businessId }, data: { quantityOnHand: { increment: quantity } } });
  }
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export const codService = {
  /**
   * Creates a COD sale. In ONE transaction: reserves stock (a guarded
   * decrement — can never go below zero, even with concurrent sales), numbers
   * it COD-0001…, writes the sale + lines + OUT movements + delivery row, and
   * audits. The sale does NOT count as revenue until it is DELIVERED.
   */
  async create(input: CodSaleCreateInput, actorId: string, businessId: string) {
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { codEnabled: true } });
    if (!business.codEnabled) throw new ForbiddenError("Cash on Delivery isn't turned on for this business. Enable it in Settings.");

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await prisma.inventoryProduct.findMany({ where: { id: { in: productIds }, businessId, isArchived: false } });
    const productMap = new Map(products.map((p) => [p.id, p]));
    if (productMap.size !== productIds.length) throw new NotFoundError("Product");

    const requestedByProduct = new Map<string, number>();
    for (const item of input.items) {
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const lines = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = item.unitPrice !== undefined ? D(item.unitPrice) : product.sellingPrice;
      return { product, quantity: item.quantity, unitPrice, lineTotal: unitPrice.mul(item.quantity) };
    });
    const totalAmount = lines.reduce((sum, l) => sum.add(l.lineTotal), D(0));
    const deliveryFee = D(input.deliveryFee);
    const codAmount = input.feePaidBy === "CUSTOMER" ? totalAmount.add(deliveryFee) : totalAmount;
    if (codAmount.gt(MAX_AMOUNT)) throw new ConflictError("The order total is too large.");

    const needsLink = input.confirmation === "LINK";
    const now = new Date();
    const phoneNormalized = normalizePhone(input.customer.phone);

    return prisma.$transaction(async (tx) => {
      for (const [productId, requested] of requestedByProduct) {
        const res = await tx.inventoryProduct.updateMany({
          where: { id: productId, businessId, isArchived: false, quantityOnHand: { gte: requested } },
          data: { quantityOnHand: { decrement: requested } },
        });
        if (res.count !== 1) {
          const p = productMap.get(productId)!;
          throw new ConflictError(`Not enough stock for "${p.name}".`);
        }
      }

      const counter = await tx.business.update({
        where: { id: businessId }, data: { lastDispatchNumber: { increment: 1 } }, select: { lastDispatchNumber: true },
      });
      const dispatchRef = `COD-${String(counter.lastDispatchNumber).padStart(4, "0")}`;

      const sale = await tx.inventorySale.create({
        data: { businessId, totalAmount, note: input.note, soldById: actorId, fulfilment: "COD_DELIVERY" },
      });
      await tx.inventorySaleItem.createMany({
        data: lines.map((l) => ({
          saleId: sale.id, productId: l.product.id, quantity: l.quantity,
          unitPrice: l.unitPrice, costPriceAtSale: l.product.costPrice, lineTotal: l.lineTotal,
        })),
      });
      await tx.inventoryStockMovement.createMany({
        data: [...requestedByProduct].map(([productId, quantity]) => ({
          productId, businessId, type: "OUT" as const, quantity, reason: "Sold (COD)", performedById: actorId,
        })),
      });

      const confirmToken = needsLink ? generateToken() : null;
      await tx.inventorySaleDelivery.create({
        data: {
          saleId: sale.id, businessId, dispatchRef,
          customerName: input.customer.name, customerPhone: input.customer.phone,
          customerPhone2: input.customer.phone2, customerPhoneNormalized: phoneNormalized,
          deliveryAddress: input.customer.address, city: input.customer.city,
          codAmount, deliveryFee, feePaidBy: input.feePaidBy,
          status: needsLink ? "PENDING_CONFIRMATION" : "PENDING_DISPATCH",
          confirmToken,
          confirmExpiresAt: needsLink ? new Date(now.getTime() + CONFIRM_LINK_TTL_MS) : null,
          confirmedAt: needsLink ? null : now,
          confirmedBy: needsLink ? null : "SELLER",
        },
      });
      await auditService.log(tx, {
        businessId, actorId, action: "COD_SALE_CREATED", entityType: "InventorySale", entityId: sale.id,
        metadata: { dispatchRef, itemCount: lines.length, codAmount: Number(codAmount), confirmation: input.confirmation },
      });
      return { id: sale.id, dispatchRef, status: needsLink ? "PENDING_CONFIRMATION" as const : "PENDING_DISPATCH" as const, confirmToken };
    });
  },

  /** Seller-side status changes. See the transition table in docs/IMPLEMENTATION_REQUIREMENTS.md (4A). */
  async transition(saleId: string, input: CodActionInput, actorId: string, businessId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const d = await tx.inventorySaleDelivery.findFirst({ where: { saleId, businessId } });
        if (!d) throw new NotFoundError("COD order");
        const now = new Date();
        const audit = (action: Parameters<typeof auditService.log>[1]["action"], metadata: Prisma.InputJsonValue) =>
          auditService.log(tx, { businessId, actorId, action, entityType: "InventorySale", entityId: saleId, metadata });

        switch (input.action) {
          case "confirm":
            await moveStatus(tx, saleId, businessId, ["PENDING_CONFIRMATION"], {
              status: "PENDING_DISPATCH", confirmedAt: now, confirmedBy: "SELLER",
            });
            await audit("COD_CONFIRMED", { dispatchRef: d.dispatchRef, by: "SELLER" });
            break;

          case "dispatch": {
            let fee = d.deliveryFee;
            let codAmount = d.codAmount;
            if (input.deliveryFee !== undefined) {
              const sale = await tx.inventorySale.findFirstOrThrow({ where: { id: saleId, businessId }, select: { totalAmount: true } });
              fee = D(input.deliveryFee);
              codAmount = d.feePaidBy === "CUSTOMER" ? sale.totalAmount.add(fee) : sale.totalAmount;
              if (codAmount.gt(MAX_AMOUNT)) throw new ConflictError("The order total is too large.");
            }
            await moveStatus(tx, saleId, businessId, ["PENDING_DISPATCH"], {
              status: "OUT_FOR_DELIVERY", courierName: input.courierName, waybillNo: input.waybillNo,
              deliveryFee: fee, codAmount, dispatchedAt: now,
            });
            await audit("COD_DISPATCHED", {
              dispatchRef: d.dispatchRef, courierName: input.courierName, waybillNo: input.waybillNo ?? null,
              codAmount: Number(codAmount),
            });
            break;
          }

          case "deliver":
            await moveStatus(tx, saleId, businessId, ["OUT_FOR_DELIVERY"], { status: "DELIVERED", deliveredAt: now });
            await audit("COD_DELIVERED", { dispatchRef: d.dispatchRef, codAmount: Number(d.codAmount) });
            break;

          case "refuse":
            await moveStatus(tx, saleId, businessId, ["OUT_FOR_DELIVERY"], {
              status: "REFUSED", closedAt: now, closedReason: input.reason,
            });
            await restoreStock(tx, saleId, businessId, actorId, "COD refused");
            await audit("COD_REFUSED", { dispatchRef: d.dispatchRef, reason: input.reason });
            break;

          case "cancel":
            await moveStatus(tx, saleId, businessId, ["PENDING_CONFIRMATION", "PENDING_DISPATCH"], {
              status: "CANCELLED", closedAt: now, closedReason: input.reason,
            });
            await restoreStock(tx, saleId, businessId, actorId, "COD cancelled");
            await audit("COD_CANCELLED", { dispatchRef: d.dispatchRef, reason: input.reason });
            break;
        }
        return { id: saleId };
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictError("That waybill number is already used for this courier.");
      throw e;
    }
  },

  /** Paginated COD order list for the COD page. */
  async list(
    businessId: string,
    opts: { status?: CodStatus[]; search?: string; page?: number; pageSize?: number } = {},
  ) {
    const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100);
    const page = Math.max(opts.page ?? 1, 1);
    const q = opts.search?.trim();
    const digits = q?.replace(/\D/g, "") ?? "";
    const where: Prisma.InventorySaleDeliveryWhereInput = {
      businessId,
      ...(opts.status?.length ? { status: { in: opts.status } } : {}),
      ...(q
        ? {
            OR: [
              { dispatchRef: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
              { waybillNo: { contains: q, mode: "insensitive" } },
              ...(digits.length >= 4 ? [{ customerPhoneNormalized: { contains: normalizePhone(q) || digits } }] : []),
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.inventorySaleDelivery.count({ where }),
      prisma.inventorySaleDelivery.findMany({
        where, orderBy: { createdAt: "desc" }, take: pageSize, skip: (page - 1) * pageSize,
        include: {
          sale: {
            select: {
              totalAmount: true, createdAt: true, note: true,
              items: { select: { quantity: true, unitPrice: true, product: { select: { sku: true, name: true } } } },
            },
          },
        },
      }),
    ]);

    // Earlier-refusal counts for the phones on this page (the "frequent refuser" badge).
    const phones = [...new Set(rows.map((r) => r.customerPhoneNormalized))];
    const refusals = phones.length
      ? await prisma.inventorySaleDelivery.groupBy({
          by: ["customerPhoneNormalized"],
          where: { businessId, status: "REFUSED", customerPhoneNormalized: { in: phones } },
          _count: { _all: true },
        })
      : [];
    const refusalByPhone = new Map(refusals.map((r) => [r.customerPhoneNormalized, r._count._all]));
    return { rows, total, page, pageSize, refusalByPhone };
  },

  async statusCounts(businessId: string) {
    const groups = await prisma.inventorySaleDelivery.groupBy({ by: ["status"], where: { businessId }, _count: { _all: true } });
    return Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<Record<CodStatus, number>>;
  },

  /** Money out with couriers (DELIVERED, not yet remitted), refusal rate, and per-status totals. */
  async summary(businessId: string) {
    const [byStatus, receivableRows] = await Promise.all([
      prisma.inventorySaleDelivery.groupBy({ by: ["status"], where: { businessId }, _count: { _all: true }, _sum: { codAmount: true } }),
      prisma.inventorySaleDelivery.findMany({
        where: { businessId, status: "DELIVERED" },
        select: { courierName: true, codAmount: true, deliveryFee: true, deliveredAt: true },
        orderBy: { deliveredAt: "asc" }, take: 1000,
      }),
    ]);
    const count = (s: CodStatus) => byStatus.find((g) => g.status === s)?._count._all ?? 0;
    const amount = (s: CodStatus) => Number(byStatus.find((g) => g.status === s)?._sum.codAmount ?? 0);

    const now = Date.now();
    const buckets = { "0-7": 0, "8-14": 0, "15+": 0 };
    const byCourier = new Map<string, number>();
    for (const r of receivableRows) {
      const days = Math.floor((now - (r.deliveredAt?.getTime() ?? now)) / 86_400_000);
      const bucket = days <= 7 ? "0-7" : days <= 14 ? "8-14" : "15+";
      // What the courier will actually pay us is the COD amount minus their fee.
      const net = Number(r.codAmount.sub(r.deliveryFee));
      buckets[bucket] += net;
      const c = r.courierName ?? "Unknown";
      byCourier.set(c, (byCourier.get(c) ?? 0) + net);
    }
    const closed = count("DELIVERED") + count("REMITTED") + count("REFUSED");
    return {
      receivable: receivableRows.reduce((s, r) => s + Number(r.codAmount.sub(r.deliveryFee)), 0),
      receivableCount: count("DELIVERED"),
      receivableTruncated: receivableRows.length === 1000,
      ageBuckets: buckets,
      byCourier: [...byCourier].map(([courierName, amount]) => ({ courierName, amount })),
      refusalRate: closed > 0 ? count("REFUSED") / closed : 0,
      counts: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])) as Partial<Record<CodStatus, number>>,
      amounts: { delivered: amount("DELIVERED"), remitted: amount("REMITTED") },
    };
  },

  /** How many earlier COD orders to this phone were refused (tenant-scoped), for the warning in the sale dialog. */
  async refusalCheck(businessId: string, phone: string) {
    const normalized = normalizePhone(phone);
    if (normalized.length < 9) return { count: 0, lastRefusedAt: null as string | null, threshold: 0, flagged: false };
    const [business, count, last] = await Promise.all([
      prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { codRefusalWarnThreshold: true } }),
      prisma.inventorySaleDelivery.count({ where: { businessId, status: "REFUSED", customerPhoneNormalized: normalized } }),
      prisma.inventorySaleDelivery.findFirst({
        where: { businessId, status: "REFUSED", customerPhoneNormalized: normalized },
        orderBy: { closedAt: "desc" }, select: { closedAt: true },
      }),
    ]);
    return {
      count, lastRefusedAt: last?.closedAt?.toISOString() ?? null,
      threshold: business.codRefusalWarnThreshold, flagged: count >= business.codRefusalWarnThreshold,
    };
  },

  /**
   * Records one courier remittance across many DELIVERED orders from the same
   * courier, and marks them REMITTED. A non-zero variance (gross - fees - net)
   * is stored and flagged, never absorbed silently.
   */
  async settle(input: CodSettlementInput, actorId: string, businessId: string) {
    const saleIds = [...new Set(input.saleIds)];
    return prisma.$transaction(async (tx) => {
      const deliveries = await tx.inventorySaleDelivery.findMany({
        where: { saleId: { in: saleIds }, businessId, status: "DELIVERED" },
      });
      if (deliveries.length !== saleIds.length) {
        throw new ConflictError("Some selected orders aren't delivered, or were already settled — refresh and try again.");
      }
      const courier = input.courierName.trim().toLowerCase();
      if (deliveries.some((d) => (d.courierName ?? "").trim().toLowerCase() !== courier)) {
        throw new ConflictError("All orders in one settlement must be from the same courier.");
      }

      const gross = deliveries.reduce((s, d) => s.add(d.codAmount), D(0));
      const fees = D(input.feesDeducted);
      const net = D(input.netReceived);
      const variance = gross.sub(fees).sub(net);

      const settlement = await tx.codSettlement.create({
        data: {
          businessId, courierName: input.courierName, reference: input.reference, receivedAt: input.receivedAt,
          grossCollected: gross, feesDeducted: fees, netReceived: net, variance, note: input.note, createdById: actorId,
        },
      });
      const res = await tx.inventorySaleDelivery.updateMany({
        where: { id: { in: deliveries.map((d) => d.id) }, businessId, status: "DELIVERED" },
        data: { status: "REMITTED", remittedAt: input.receivedAt, settlementId: settlement.id },
      });
      if (res.count !== deliveries.length) throw new ConflictError(STALE);

      await auditService.log(tx, {
        businessId, actorId, action: "COD_SETTLED", entityType: "CodSettlement", entityId: settlement.id,
        metadata: {
          courierName: input.courierName, orders: deliveries.length,
          gross: Number(gross), fees: Number(fees), net: Number(net), variance: Number(variance),
        },
      });
      return { id: settlement.id, orders: deliveries.length, gross: Number(gross), variance: Number(variance) };
    });
  },

  /** For the dispatch sheet PDF. */
  getForSheet(saleId: string, businessId: string) {
    return prisma.inventorySaleDelivery.findFirst({
      where: { saleId, businessId },
      include: {
        business: { select: { name: true, logoUrl: true } },
        sale: { select: { totalAmount: true, items: { select: { quantity: true, unitPrice: true, lineTotal: true, product: { select: { sku: true, name: true } } } } } },
      },
    });
  },

  // ---------------- Public, token-based (customer confirmation page) ----------------

  /** Read-only view for the confirmation page. Returns null for an unknown token. */
  async getForConfirmation(token: string) {
    if (!token || token.length < 20) return null;
    const d = await prisma.inventorySaleDelivery.findUnique({
      where: { confirmToken: token },
      select: {
        dispatchRef: true, status: true, confirmExpiresAt: true,
        customerName: true, customerPhone: true, customerPhone2: true, deliveryAddress: true, city: true,
        codAmount: true, deliveryFee: true, feePaidBy: true,
        business: { select: { name: true, logoUrl: true } },
        sale: { select: { totalAmount: true, items: { select: { quantity: true, unitPrice: true, lineTotal: true, product: { select: { name: true } } } } } },
      },
    });
    if (!d) return null;
    const expired = d.status === "PENDING_CONFIRMATION" && !!d.confirmExpiresAt && d.confirmExpiresAt.getTime() <= Date.now();
    return { ...d, open: d.status === "PENDING_CONFIRMATION" && !expired, expired };
  },

  /**
   * The customer's answer from the public page. Works only while the order is
   * PENDING_CONFIRMATION and the link hasn't expired; the conditional update
   * makes a double tap, or confirming after declining, a no-op conflict. The
   * customer can fix their contact/address details but never the items or the
   * amount. Audited under the seller who created the sale (there is no user).
   */
  async answerConfirmation(token: string, input: CodConfirmInput) {
    return prisma.$transaction(async (tx) => {
      const d = await tx.inventorySaleDelivery.findUnique({
        where: { confirmToken: token },
        select: { saleId: true, businessId: true, dispatchRef: true, sale: { select: { soldById: true } } },
      });
      if (!d) throw new NotFoundError("Order");
      const now = new Date();
      const live = { confirmToken: token, status: "PENDING_CONFIRMATION" as const, confirmExpiresAt: { gt: now } };
      const actorId = d.sale.soldById;

      if (input.action === "confirm") {
        const c = input.customer;
        const res = await tx.inventorySaleDelivery.updateMany({
          where: live,
          data: {
            status: "PENDING_DISPATCH", confirmedAt: now, confirmedBy: "CUSTOMER",
            customerName: c.name, customerPhone: c.phone, customerPhone2: c.phone2 ?? null,
            customerPhoneNormalized: normalizePhone(c.phone), deliveryAddress: c.address, city: c.city ?? null,
          },
        });
        if (res.count !== 1) throw new ConflictError("This link is no longer active.");
        await auditService.log(tx, {
          businessId: d.businessId, actorId, action: "COD_CONFIRMED", entityType: "InventorySale", entityId: d.saleId,
          metadata: { dispatchRef: d.dispatchRef, by: "CUSTOMER" },
        });
        return { status: "PENDING_DISPATCH" as const };
      }

      const res = await tx.inventorySaleDelivery.updateMany({
        where: live, data: { status: "CANCELLED", closedAt: now, closedReason: "Declined by customer" },
      });
      if (res.count !== 1) throw new ConflictError("This link is no longer active.");
      await restoreStock(tx, d.saleId, d.businessId, actorId, "COD cancelled");
      await auditService.log(tx, {
        businessId: d.businessId, actorId, action: "COD_CANCELLED", entityType: "InventorySale", entityId: d.saleId,
        metadata: { dispatchRef: d.dispatchRef, reason: "Declined by customer", by: "CUSTOMER" },
      });
      return { status: "CANCELLED" as const };
    });
  },
};
