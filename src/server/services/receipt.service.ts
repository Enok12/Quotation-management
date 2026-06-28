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

    const totals = calcReceiptTotals(input);

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
          paymentStatus: derivePaymentStatus(totals.totalDue, input.advanceAmount, input.amountPaid),
          createdById: actorId,
          items: {
            create: input.items.map((it, i) => ({
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
    const totals = calcReceiptTotals(input);

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
          paymentStatus: derivePaymentStatus(totals.totalDue, input.advanceAmount, input.amountPaid),
          currentVersion: existing.status === "FINALIZED" ? existing.currentVersion + 1 : existing.currentVersion,
          items: {
            create: input.items.map((it, i) => ({
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

  // -------- Finalize --------
  async finalize(id: string, actorId: string) {
    const existing = await this.getFull(id);
    if (existing.status === "FINALIZED") throw new ConflictError("Receipt is already finalized");

    return prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.update({
        where: { id },
        data: {
          status: "FINALIZED",
          finalizedAt: new Date(),
          finalizedById: actorId,
          orderStatus: "FABRIC_SELECTION",
        },
      });
      await tx.orderStatusHistory.create({
        data: { receiptId: id, fromStatus: null, toStatus: "FABRIC_SELECTION", changedById: actorId, note: "Receipt finalized" },
      });
      await auditService.log(tx, {
        actorId, action: "RECEIPT_FINALIZED", entityType: "Receipt", entityId: id,
      });
      return receipt;
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
    const advance = Number(existing.advanceAmount);
    const newAmountPaid = Math.round((Number(existing.amountPaid) + input.amount + Number.EPSILON) * 100) / 100;
    const balance = Math.round((totalDue - advance - newAmountPaid + Number.EPSILON) * 100) / 100;
    const paymentStatus = derivePaymentStatus(totalDue, advance, newAmountPaid);

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
        data: { amountPaid: D(newAmountPaid), balance: D(balance), paymentStatus },
      });
      await auditService.log(tx, {
        actorId, action: "PAYMENT_RECORDED", entityType: "Receipt", entityId: id,
        metadata: { amount: input.amount, paymentStatus },
      });
      return receipt;
    });
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
