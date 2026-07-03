import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { calcReceiptTotals, derivePaymentStatus } from "./receipt-calc";
import { auditService } from "./audit.service";
import { receiptRepository, type FullReceipt } from "../repositories/receipt.repository";
import type { ReceiptCreateInput } from "@/lib/validation/receipt.schema";

const D = (n: number) => new Prisma.Decimal(n);

export const receiptService = {
  getFull(id: string) {
    return receiptRepository.findFull(id).then((r) => {
      if (!r) throw new NotFoundError("Receipt");
      return r;
    });
  },

  // -------- Create (always starts as DRAFT) --------
  async create(input: ReceiptCreateInput, actorId: string) {
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundError("Customer");

    // Sample orders are single-unit — force every line to quantity 1.
    const items = input.orderType === "SAMPLE" ? input.items.map((i) => ({ ...i, quantity: 1 })) : input.items;
    const totals = calcReceiptTotals({ ...input, items });

    return prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
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
          // Receipts go live immediately — no separate finalization step.
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
            create: input.adjustments.map((a, i) => ({ label: a.label, amount: D(a.amount), sortOrder: i })),
          },
        },
      });
      await tx.orderStatusHistory.create({
        data: { receiptId: receipt.id, fromStatus: null, toStatus: "FABRIC_SELECTION", changedById: actorId, note: "Receipt created" },
      });
      await auditService.log(tx, {
        actorId, action: "RECEIPT_CREATED", entityType: "Receipt", entityId: receipt.id,
      });
      return receipt;
    });
  },

  // -------- Update --------
  // DRAFT: edit in place. FINALIZED: snapshot the current state as a new version
  // first (admin-only enforcement lives in the route).
  async update(id: string, input: ReceiptCreateInput, actorId: string) {
    const existing = await this.getFull(id);
    const items = input.orderType === "SAMPLE" ? input.items.map((i) => ({ ...i, quantity: 1 })) : input.items;
    const totals = calcReceiptTotals({ ...input, items });

    return prisma.$transaction(async (tx) => {
      if (existing.status === "FINALIZED") {
        await this.snapshotVersion(tx, existing, actorId, "Edited after finalization");
      }
      // Replace child rows wholesale (simplest correct approach for small tables).
      await tx.receiptItem.deleteMany({ where: { receiptId: id } });
      await tx.receiptAdjustment.deleteMany({ where: { receiptId: id } });

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
          currentVersion: existing.status === "FINALIZED" ? existing.currentVersion + 1 : existing.currentVersion,
          items: {
            create: items.map((it, i) => ({
              description: it.description, quantity: it.quantity,
              unitPrice: D(it.unitPrice), lineTotal: D(totals.lineTotals[i]), sortOrder: i,
            })),
          },
          adjustments: {
            create: input.adjustments.map((a, i) => ({ label: a.label, amount: D(a.amount), sortOrder: i })),
          },
        },
      });
      await auditService.log(tx, {
        actorId, action: "RECEIPT_UPDATED", entityType: "Receipt", entityId: id,
      });
      return updated;
    });
  },

  // -------- Order status --------
  async changeOrderStatus(id: string, to: FullReceipt["orderStatus"], actorId: string, note?: string) {
    const existing = await this.getFull(id);
    if (existing.status !== "FINALIZED") throw new ConflictError("Finalize the receipt before tracking order status");
    if (existing.orderStatus === to) return existing;

    return prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.update({ where: { id }, data: { orderStatus: to } });
      await tx.orderStatusHistory.create({
        data: { receiptId: id, fromStatus: existing.orderStatus, toStatus: to, changedById: actorId, note },
      });
      await auditService.log(tx, {
        actorId, action: "ORDER_STATUS_CHANGED", entityType: "Order", entityId: id,
        metadata: { from: existing.orderStatus, to },
      });
      return receipt;
    });
  },

  // -------- Record a payment (instalment) --------
  // Appends to the payment ledger, bumps the running amountPaid, and lets the
  // receipt move between the Unpaid / Partial / Completed folders automatically.
  async recordPayment(
    id: string,
    input: { amount: number; method?: FullReceipt["paymentMethods"][number] | null; note?: string | null },
    actorId: string,
  ) {
    const existing = await this.getFull(id);
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
      const receipt = await tx.receipt.update({
        where: { id },
        data: {
          amountPaid: D(newAmountPaid),
          balance: D(balance),
          paymentStatus,
          paymentMethods: { set: Array.from(methods) },
        },
      });
      await auditService.log(tx, {
        actorId, action: "PAYMENT_RECORDED", entityType: "Receipt", entityId: id,
        metadata: { amount: input.amount, paymentStatus },
      });
      return receipt;
    });
  },

  // -------- Create a bulk order from an approved sample --------
  // The sample receipt is left completely untouched (it stays in Sample
  // Orders); a brand-new BULK receipt is created from its items/adjustments
  // so staff can set the real bulk quantities on it.
  async createBulkFromSample(sampleId: string, actorId: string) {
    const sample = await this.getFull(sampleId);
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
      });
      await tx.orderStatusHistory.create({
        data: {
          receiptId: receipt.id, fromStatus: null, toStatus: "FABRIC_SELECTION", changedById: actorId,
          note: `Created from sample receipt #${sample.receiptNumber}`,
        },
      });
      await auditService.log(tx, {
        actorId, action: "RECEIPT_CREATED", entityType: "Receipt", entityId: receipt.id,
        metadata: { fromSampleId: sampleId, fromSampleReceiptNumber: sample.receiptNumber },
      });
      return receipt;
    });
  },

  // -------- Delete a receipt (e.g. a rejected sample) --------
  async remove(id: string, actorId: string) {
    const existing = await this.getFull(id);
    await prisma.$transaction(async (tx) => {
      await auditService.log(tx, {
        actorId, action: "RECEIPT_DELETED", entityType: "Receipt", entityId: id,
        metadata: { receiptNumber: existing.receiptNumber, orderType: existing.orderType },
      });
      await tx.receipt.delete({ where: { id } }); // cascades items/adjustments/payments/history/versions
    });
    return existing;
  },

  listVersions: (receiptId: string) => receiptRepository.listVersions(receiptId),

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
      actorId, action: "VERSION_CREATED", entityType: "Receipt", entityId: receipt.id,
      metadata: { version: receipt.currentVersion },
    });
  },
};
