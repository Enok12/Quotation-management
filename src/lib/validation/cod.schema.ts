import { z } from "zod";
import { saleItemSchema } from "./sale.schema";

// LKR amount with at most 2 decimals, bounded to what Decimal(12,2) can hold —
// an unbounded value would overflow the column and come back as a 500.
const money = z.number().finite().nonnegative().max(9_999_999_999.99).refine(
  (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
  "At most 2 decimal places",
);

const text = (max: number) => z.string().trim().max(max);

export const codCustomerSchema = z.object({
  name: text(120).min(1, "Customer name is required"),
  phone: text(30).refine((v) => v.replace(/\D/g, "").length >= 9, "Enter a valid phone number"),
  phone2: text(30).optional().transform((v) => v || undefined),
  address: text(300).min(1, "Delivery address is required"),
  city: text(80).optional().transform((v) => v || undefined),
});

export const codSaleCreateSchema = z.object({
  fulfilment: z.literal("COD_DELIVERY"),
  items: z.array(saleItemSchema).min(1, "Add at least one product"),
  customer: codCustomerSchema,
  // Typed in by the seller per order; no courier rate table.
  deliveryFee: money.default(0),
  feePaidBy: z.enum(["CUSTOMER", "BUSINESS"]).default("CUSTOMER"),
  // LINK: start in PENDING_CONFIRMATION and issue a customer confirmation link.
  // ALREADY_CONFIRMED: the seller already has everything from the chat.
  confirmation: z.enum(["LINK", "ALREADY_CONFIRMED"]).default("LINK"),
  note: z.string().max(500).optional(),
});
export type CodSaleCreateInput = z.infer<typeof codSaleCreateSchema>;

export const codActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({
    action: z.literal("dispatch"),
    // Free text: the courier isn't chosen yet, and an own rider can be a name too.
    courierName: text(80).min(1, "Courier name is required to dispatch"),
    // Issued by the courier and typed in here; blank is fine for an own rider.
    waybillNo: text(80).optional().transform((v) => v || undefined),
    deliveryFee: money.optional(),
  }),
  z.object({ action: z.literal("deliver") }),
  z.object({ action: z.literal("refuse"), reason: text(300).min(1, "A reason is required") }),
  z.object({ action: z.literal("cancel"), reason: text(300).min(1, "A reason is required") }),
]);
export type CodActionInput = z.infer<typeof codActionSchema>;

export const codSettlementSchema = z.object({
  saleIds: z.array(z.string().min(1)).min(1, "Select at least one order").max(200),
  courierName: text(80).min(1, "Courier name is required"),
  reference: text(120).optional().transform((v) => v || undefined),
  receivedAt: z.coerce.date(),
  feesDeducted: money,
  netReceived: money,
  note: z.string().max(500).optional(),
});
export type CodSettlementInput = z.infer<typeof codSettlementSchema>;

// What the customer may change on the public confirmation page. Items, prices
// and the amount are deliberately NOT editable by the customer.
export const codConfirmSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), customer: codCustomerSchema }),
  z.object({ action: z.literal("decline") }),
]);
export type CodConfirmInput = z.infer<typeof codConfirmSchema>;

export const codSettingsSchema = z.object({
  codEnabled: z.boolean(),
  codRefusalWarnThreshold: z.number().int().min(1).max(20),
});
