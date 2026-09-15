import { z } from "zod";

const paymentMethod = z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"]);

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  // Defaults to the product's current sellingPrice if omitted — lets a
  // cashier override for a negotiated/discounted price on a given line.
  unitPrice: z.number().nonnegative().optional(),
});

export const saleCreateSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Add at least one product"),
  paymentMethod: paymentMethod.optional(),
  note: z.string().max(500).optional(),
});
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;
