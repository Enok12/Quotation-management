import { z } from "zod";

const paymentMethod = z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]);

export const receiptItemSchema = z.object({
  // Present when editing an existing item — lets the service preserve its
  // id (and therefore its order status / history) instead of recreating it.
  // Absent for newly added rows.
  itemId: z.string().optional(),
  description: z.string().min(1).max(300),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const receiptAdjustmentSchema = z.object({
  label: z.string().min(1).max(120),
  amount: z.number(), // negative = discount (e.g. "Pattern": -6600)
});

export const receiptCreateSchema = z.object({
  customerId: z.string().min(1),
  date: z.coerce.date().optional(),
  notes: z.string().max(2000).optional().nullable(),
  paymentMethods: z.array(paymentMethod).default([]),
  items: z.array(receiptItemSchema).min(1, "At least one item is required"),
  adjustments: z.array(receiptAdjustmentSchema).default([]),
  advanceAmount: z.number().nonnegative().default(0),
  amountPaid: z.number().nonnegative().default(0),
  orderType: z.enum(["BULK", "SAMPLE"]).default("BULK"),
  category: z.enum(["MEN", "WOMEN"]).default("WOMEN"),
});
export const receiptUpdateSchema = receiptCreateSchema.partial();

export const orderStatusSchema = z.object({
  status: z.enum([
    "FABRIC_SELECTION", "CUTTING", "PRODUCTION", "QUALITY_CHECK", "IRON_PACKING", "DELIVERY",
  ]),
  note: z.string().max(500).optional(),
});

export type ReceiptCreateInput = z.infer<typeof receiptCreateSchema>;
