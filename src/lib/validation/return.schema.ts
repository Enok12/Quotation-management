import { z } from "zod";

export const returnCreateSchema = z.object({
  saleItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  // Defaults to the sale item's own unit price × quantity if omitted.
  refundAmount: z.number().nonnegative().optional(),
  reason: z.string().min(1).max(120),
  note: z.string().max(500).optional(),
});
export type ReturnCreateInput = z.infer<typeof returnCreateSchema>;
