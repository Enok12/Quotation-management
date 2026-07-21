import { Prisma, type OrderType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { calcReceiptTotals, derivePaymentStatus } from "./receipt-calc";
import { auditService } from "./audit.service";
import { receiptRepository, type FullReceipt } from "../repositories/receipt.repository";
import type { ReceiptCreateInput } from "@/lib/validation/receipt.schema";
import { generateToken } from "@/lib/utils/token";
import { bottleneckStage, type OrderStage } from "@/lib/order-stage";
import { receiptNumberLabel } from "@/lib/utils/receipt-number";

const D = (n: number) => new Prisma.Decimal(n);

// A new Bulk order with nothing paid yet stays "Unconfirmed" — no invoice
// number, no tracking token — until the advance payment lands. Sample orders
// and any order with money already collected confirm immediately, same as
// before this existed.
const isConfirmedState = (orderType: string, amountPaid: number) => orderType !== "BULK" || amountPaid > 0;

// Atomically pulls the next invoice number for a business. Bulk and Sample
// draw from two independent counters, so Bulk #1 and Sample #1 can both
// exist (they're told apart by the "S-" prefix Samples render under — see
// lib/utils/receipt-number.ts). Postgres serializes concurrent updates to the
// same row, so this stays race-safe per sequence.
async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  orderType: OrderType,
): Promise<number> {
  const isSample = orderType === "SAMPLE";
  const business = await tx.business.update({
    where: { id: businessId },
    data: isSample ? { lastSampleNumber: { increment: 1 } } : { lastReceiptNumber: { increment: 1 } },
  });
  return isSample ? business.lastSampleNumber : business.lastReceiptNumber;
}

export const receiptService = {
  getFull(id: string, businessId: string) {
    return receiptRepository.findFull(id, businessId).then((r) => {
      if (!r) throw new NotFoundError("Receipt");
      return r;
    });
  },

  // -------- Create (always starts as DRAFT) --------
  async create(input: ReceiptCreateInput, actorId: string, businessId: string) {
    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, businessId } });
    if (!customer) throw new NotFoundError("Customer");

    const totals = calcReceiptTotals(input);
    // Fully paid at creation (e.g. a bulk-upload review of an already-settled
    // historical order) is a strong signal the whole order is already done.
    const initialStatus: OrderStage = input.startCompleted ? "COMPLETED" : "FABRIC_SELECTION";
    const confirmedAtCreation = input.startCompleted || isConfirmedState(input.orderType, input.amountPaid);

    return prisma.$transaction(async (tx) => {
      const receiptNumber = confirmedAtCreation ? await nextReceiptNumber(tx, businessId, input.orderType) : null;
      // Only bulk orders get a public tracking link — samples get none, and
      // an unconfirmed bulk order doesn't have one yet either.
      const trackingToken = input.orderType === "BULK" && confirmedAtCreation ? generateToken() : null;

      const receipt = await tx.receipt.create({
        data: {
          businessId,
          receiptNumber,
          customerId: customer.id,
          custName: customer.name,
          custAddress: customer.address,
          custPhone: customer.phone,
          custEmail: customer.email,
          date: input.date ?? new Date(),
          notes: input.notes,
          paymentMethods: input.paymentMethods,
          subtotal: D(totals.subtotal),
          adjustmentsTotal: D(totals.adjustmentsTotal),
          totalDue: D(totals.totalDue),
          advanceAmount: D(input.advanceAmount),
          amountPaid: D(input.amountPaid),
          balance: D(totals.balance),
          paymentStatus: derivePaymentStatus(totals.totalDue, input.amountPaid),
          orderType: input.orderType,
          category: input.category,
          trackingToken,
          // Receipts go live immediately — no separate finalization step.
          status: "FINALIZED",
          finalizedAt: new Date(),
          finalizedById: actorId,
          orderStatus: initialStatus,
          createdById: actorId,
          items: {
            create: input.items.map((it, i) => ({
              description: it.description, quantity: it.quantity,
              unitPrice: D(it.unitPrice), lineTotal: D(totals.lineTotals[i]), sortOrder: i,
              orderStatus: initialStatus,
            })),
          },
          adjustments: {
            create: input.adjustments.map((a, i) => ({ label: a.label, amount: D(a.amount), sortOrder: i })),
          },
        },
        include: { items: true },
      });
      // One history row per item — tracking is per item from the start.
      await tx.orderStatusHistory.createMany({
        data: receipt.items.map((item) => ({
          receiptId: receipt.id, itemId: item.id, fromStatus: null, toStatus: initialStatus,
          changedById: actorId, note: input.startCompleted ? "Receipt created (already fully paid)" : "Receipt created",
        })),
      });
      await auditService.log(tx, {
        businessId, actorId, action: "RECEIPT_CREATED", entityType: "Receipt", entityId: receipt.id,
      });
      return receipt;
    });
  },

  // -------- Update --------
  // DRAFT: edit in place. FINALIZED: snapshot the current state as a new version
  // first (admin-only enforcement lives in the route).
  //
  // Items are reconciled by id rather than wholesale-replaced (unlike
  // adjustments, which carry no state) — an item's orderStatus and history
  // are meaningful production-tracking state that an unrelated edit (e.g.
  // fixing a price typo) must not silently reset.
  async update(id: string, input: ReceiptCreateInput, actorId: string, businessId: string) {
    const existing = await this.getFull(id, businessId);
    // Bulk and Sample are separate invoice sequences, so a receipt's type is
    // baked into the number it was issued. Switching type afterwards would
    // either strand it in the wrong sequence or force renumbering a document
    // the customer already has — so it's refused once a number exists.
    // Still free to switch while Unconfirmed, which is the usual case.
    if (existing.receiptNumber !== null && input.orderType !== existing.orderType) {
      throw new ConflictError(
        `This order already has invoice number ${receiptNumberLabel(existing.receiptNumber, existing.orderType)}. Bulk and Sample use separate invoice numbers, so the type can't be changed once one has been issued.`,
      );
    }
    const totals = calcReceiptTotals(input);
    // Once confirmed, always confirmed — a number is never reclaimed. But an
    // edit can be what *first* confirms it (e.g. entering amountPaid directly
    // instead of via Record Payment, or switching an unconfirmed Bulk order
    // to Sample, which always confirms immediately).
    const nowConfirms = existing.receiptNumber === null && isConfirmedState(input.orderType, input.amountPaid);

    return prisma.$transaction(async (tx) => {
      if (existing.status === "FINALIZED") {
        await this.snapshotVersion(tx, existing, actorId, "Edited after finalization");
      }

      const keepIds = new Set(input.items.map((it) => it.itemId).filter((v): v is string => !!v));
      const toRemove = existing.items.filter((it) => !keepIds.has(it.id));
      if (toRemove.length > 0) {
        await tx.receiptItem.deleteMany({ where: { id: { in: toRemove.map((it) => it.id) } } });
      }

      const survivingStatuses: string[] = [];
      for (const [i, it] of input.items.entries()) {
        const existingItem = it.itemId ? existing.items.find((e) => e.id === it.itemId) : undefined;
        if (existingItem) {
          await tx.receiptItem.update({
            where: { id: existingItem.id },
            data: {
              description: it.description, quantity: it.quantity,
              unitPrice: D(it.unitPrice), lineTotal: D(totals.lineTotals[i]), sortOrder: i,
            },
          });
          survivingStatuses.push(existingItem.orderStatus);
        } else {
          const created = await tx.receiptItem.create({
            data: {
              receiptId: id, description: it.description, quantity: it.quantity,
              unitPrice: D(it.unitPrice), lineTotal: D(totals.lineTotals[i]), sortOrder: i,
            },
          });
          survivingStatuses.push(created.orderStatus);
        }
      }

      await tx.receiptAdjustment.deleteMany({ where: { receiptId: id } });
      await tx.receiptAdjustment.createMany({
        data: input.adjustments.map((a, i) => ({ receiptId: id, label: a.label, amount: D(a.amount), sortOrder: i })),
      });

      const receiptNumber = nowConfirms ? await nextReceiptNumber(tx, businessId, input.orderType) : existing.receiptNumber;
      // Samples never carry a token; a bulk order gets one the moment it's
      // confirmed (now or previously), keeping whichever one it already had.
      const trackingToken =
        input.orderType !== "BULK" ? null : receiptNumber !== null ? (existing.trackingToken ?? generateToken()) : null;

      const updated = await tx.receipt.update({
        where: { id },
        data: {
          notes: input.notes,
          paymentMethods: input.paymentMethods,
          subtotal: D(totals.subtotal),
          adjustmentsTotal: D(totals.adjustmentsTotal),
          totalDue: D(totals.totalDue),
          advanceAmount: D(input.advanceAmount),
          amountPaid: D(input.amountPaid),
          balance: D(totals.balance),
          paymentStatus: derivePaymentStatus(totals.totalDue, input.amountPaid),
          orderType: input.orderType,
          category: input.category,
          receiptNumber,
          trackingToken,
          currentVersion: existing.status === "FINALIZED" ? existing.currentVersion + 1 : existing.currentVersion,
          // Adding/removing items can shift the bottleneck even though no
          // status was explicitly changed (e.g. a brand-new item starts at
          // Fabric Selection).
          orderStatus: bottleneckStage(survivingStatuses),
        },
      });
      await auditService.log(tx, {
        businessId: existing.businessId, actorId, action: "RECEIPT_UPDATED", entityType: "Receipt", entityId: id,
      });
      if (nowConfirms) {
        await auditService.log(tx, {
          businessId: existing.businessId, actorId, action: "ORDER_CONFIRMED", entityType: "Receipt", entityId: id,
        });
      }
      return updated;
    });
  },

  // -------- Order status (per item) --------
  async changeItemStatus(itemId: string, to: OrderStage, actorId: string, businessId: string, note?: string) {
    const item = await prisma.receiptItem.findUnique({ where: { id: itemId }, include: { receipt: true } });
    if (!item || item.receipt.businessId !== businessId) throw new NotFoundError("Item");
    if (item.receipt.status !== "FINALIZED") throw new ConflictError("Finalize the receipt before tracking order status");
    if (item.receipt.receiptNumber === null) throw new ConflictError("Confirm the order (record the advance payment) before tracking production status");
    if (item.orderStatus === to) return item;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.receiptItem.update({ where: { id: itemId }, data: { orderStatus: to } });
      await tx.orderStatusHistory.create({
        data: { receiptId: item.receiptId, itemId, fromStatus: item.orderStatus, toStatus: to, changedById: actorId, note },
      });
      const siblings = await tx.receiptItem.findMany({ where: { receiptId: item.receiptId }, select: { orderStatus: true } });
      await tx.receipt.update({
        where: { id: item.receiptId },
        data: { orderStatus: bottleneckStage(siblings.map((s) => s.orderStatus)) },
      });
      await auditService.log(tx, {
        businessId, actorId, action: "ORDER_STATUS_CHANGED", entityType: "ReceiptItem", entityId: itemId,
        metadata: { receiptId: item.receiptId, from: item.orderStatus, to },
      });
      return updated;
    });
  },

  // -------- Order status (all items at once) --------
  // Convenience shortcut for the common case where every item on an order
  // genuinely moves together — per-item changes remain always available too.
  async setAllItemsStatus(id: string, to: OrderStage, actorId: string, businessId: string, note?: string) {
    const existing = await this.getFull(id, businessId);
    if (existing.status !== "FINALIZED") throw new ConflictError("Finalize the receipt before tracking order status");
    if (existing.receiptNumber === null) throw new ConflictError("Confirm the order (record the advance payment) before tracking production status");

    return prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        if (item.orderStatus === to) continue;
        await tx.receiptItem.update({ where: { id: item.id }, data: { orderStatus: to } });
        await tx.orderStatusHistory.create({
          data: { receiptId: id, itemId: item.id, fromStatus: item.orderStatus, toStatus: to, changedById: actorId, note },
        });
      }
      const receipt = await tx.receipt.update({ where: { id }, data: { orderStatus: to } });
      await auditService.log(tx, {
        businessId: existing.businessId, actorId, action: "ORDER_STATUS_CHANGED", entityType: "Receipt", entityId: id,
        metadata: { to, bulk: true },
      });
      return receipt;
    });
  },

  // -------- Record a payment (instalment) --------
  // Appends to the payment ledger, bumps the running amountPaid, and lets the
  // receipt move between the Unpaid / Partial / Completed folders automatically.
  // If this receipt is still Unconfirmed, this payment is what confirms it —
  // assigns its invoice number and tracking token in the same transaction.
  async recordPayment(
    id: string,
    input: { amount: number; method?: FullReceipt["paymentMethods"][number] | null; note?: string | null },
    actorId: string,
    businessId: string,
  ) {
    const existing = await this.getFull(id, businessId);
    if (existing.status !== "FINALIZED") {
      throw new ConflictError("Finalize the receipt before recording payments");
    }
    if (!(input.amount > 0)) throw new ConflictError("Payment amount must be greater than zero");

    const totalDue = Number(existing.totalDue);
    const advanceAmount = Number(existing.advanceAmount);
    const newAmountPaid = Math.round((Number(existing.amountPaid) + input.amount + Number.EPSILON) * 100) / 100;
    // Balance never shows more owed than totalDue - advanceAmount — the advance
    // is reserved from the start. Once real payments exceed it, balance tracks them.
    const balance = Math.round((totalDue - Math.max(advanceAmount, newAmountPaid) + Number.EPSILON) * 100) / 100;
    const paymentStatus = derivePaymentStatus(totalDue, newAmountPaid);
    const nowConfirms = existing.receiptNumber === null;

    // Reflect the method used on the receipt's Payment Information block (and PDF).
    const methods = new Set(existing.paymentMethods);
    if (input.method) methods.add(input.method);

    return prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          receiptId: id,
          amount: D(input.amount),
          method: input.method ?? null,
          note: input.note ?? null,
          recordedById: actorId,
        },
      });
      const receiptNumber = nowConfirms ? await nextReceiptNumber(tx, businessId, existing.orderType) : existing.receiptNumber;
      const trackingToken = nowConfirms ? generateToken() : existing.trackingToken;
      const receipt = await tx.receipt.update({
        where: { id },
        data: {
          amountPaid: D(newAmountPaid),
          balance: D(balance),
          paymentStatus,
          paymentMethods: { set: Array.from(methods) },
          receiptNumber,
          trackingToken,
        },
      });
      await auditService.log(tx, {
        businessId: existing.businessId, actorId, action: "PAYMENT_RECORDED", entityType: "Receipt", entityId: id,
        metadata: { amount: input.amount, paymentStatus },
      });
      if (nowConfirms) {
        await auditService.log(tx, {
          businessId: existing.businessId, actorId, action: "ORDER_CONFIRMED", entityType: "Receipt", entityId: id,
        });
      }
      return receipt;
    });
  },

  // -------- Create a bulk order from an approved sample --------
  // The sample receipt is left completely untouched (it stays in Sample
  // Orders); a brand-new BULK receipt is created from its items/adjustments
  // so staff can set the real bulk quantities on it. Starts Unconfirmed, same
  // as any other new bulk order with nothing paid yet.
  async createBulkFromSample(sampleId: string, actorId: string, businessId: string) {
    const sample = await this.getFull(sampleId, businessId);
    if (sample.orderType !== "SAMPLE") throw new ConflictError("Only sample orders can be converted");

    const items = sample.items.map((it) => ({
      description: it.description, quantity: it.quantity, unitPrice: Number(it.unitPrice),
    }));
    const adjustments = sample.adjustments.map((a) => ({ label: a.label, amount: Number(a.amount) }));
    const preTotals = calcReceiptTotals({ items, adjustments, advanceAmount: 0, amountPaid: 0 });
    const advanceAmount = Math.round(preTotals.totalDue * 0.6 * 100) / 100;
    // Recompute with the real advance so balance = totalDue - advanceAmount (nothing paid yet).
    const totals = calcReceiptTotals({ items, adjustments, advanceAmount, amountPaid: 0 });

    return prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          businessId: sample.businessId,
          receiptNumber: null,
          customerId: sample.customerId,
          custName: sample.custName,
          custAddress: sample.custAddress,
          custPhone: sample.custPhone,
          custEmail: sample.custEmail,
          date: new Date(),
          notes: sample.notes,
          paymentMethods: sample.paymentMethods,
          subtotal: D(totals.subtotal),
          adjustmentsTotal: D(totals.adjustmentsTotal),
          totalDue: D(totals.totalDue),
          advanceAmount: D(advanceAmount),
          amountPaid: D(0),
          balance: D(totals.balance),
          paymentStatus: derivePaymentStatus(totals.totalDue, 0),
          orderType: "BULK",
          category: sample.category,
          trackingToken: null,
          status: "FINALIZED",
          finalizedAt: new Date(),
          finalizedById: actorId,
          orderStatus: "FABRIC_SELECTION",
          createdById: actorId,
          items: {
            create: items.map((it, i) => ({
              description: it.description, quantity: it.quantity,
              unitPrice: D(it.unitPrice), lineTotal: D(totals.lineTotals[i]), sortOrder: i,
            })),
          },
          adjustments: {
            create: adjustments.map((a, i) => ({ label: a.label, amount: D(a.amount), sortOrder: i })),
          },
        },
        include: { items: true },
      });
      await tx.orderStatusHistory.createMany({
        data: receipt.items.map((item) => ({
          receiptId: receipt.id, itemId: item.id, fromStatus: null, toStatus: "FABRIC_SELECTION" as const,
          changedById: actorId,
          note: `Created from sample receipt ${sample.receiptNumber !== null ? receiptNumberLabel(sample.receiptNumber, "SAMPLE") : "(unnumbered)"}`,
        })),
      });
      await auditService.log(tx, {
        businessId: sample.businessId, actorId, action: "RECEIPT_CREATED", entityType: "Receipt", entityId: receipt.id,
        metadata: { fromSampleId: sampleId, fromSampleReceiptNumber: sample.receiptNumber },
      });
      return receipt;
    });
  },

  // -------- Delete a receipt (e.g. a rejected sample) --------
  async remove(id: string, actorId: string, businessId: string) {
    const existing = await this.getFull(id, businessId);
    await prisma.$transaction(async (tx) => {
      await auditService.log(tx, {
        businessId: existing.businessId, actorId, action: "RECEIPT_DELETED", entityType: "Receipt", entityId: id,
        metadata: { receiptNumber: existing.receiptNumber, orderType: existing.orderType },
      });
      await tx.receipt.delete({ where: { id } }); // cascades items/adjustments/payments/history/versions
    });
    return existing;
  },

  listVersions: (receiptId: string, businessId: string) => receiptRepository.listVersions(receiptId, businessId),

  // -------- internal: snapshot a version --------
  async snapshotVersion(
    tx: Prisma.TransactionClient,
    receipt: FullReceipt,
    actorId: string,
    summary: string,
  ) {
    await tx.receiptVersion.create({
      data: {
        receiptId: receipt.id,
        versionNumber: receipt.currentVersion,
        snapshot: receipt as unknown as Prisma.InputJsonValue,
        changeSummary: summary,
        modifiedById: actorId,
      },
    });
    await auditService.log(tx, {
      businessId: receipt.businessId, actorId, action: "VERSION_CREATED", entityType: "Receipt", entityId: receipt.id,
      metadata: { version: receipt.currentVersion },
    });
  },
};
