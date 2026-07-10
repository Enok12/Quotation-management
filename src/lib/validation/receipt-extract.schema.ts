import { z } from "zod";

// Shape Gemini is asked to return when reading a photo of a MONTRA receipt.
// Every field is best-effort — validated defensively since it's model output,
// never trusted enough to auto-submit without staff review.
export const receiptExtractSchema = z.object({
  customerName: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  date: z.string().nullable().default(null),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.coerce.number().nonnegative(),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .default([]),
  adjustments: z
    .array(z.object({ label: z.string(), amount: z.coerce.number() }))
    .default([]),
  advanceAmount: z.coerce.number().nullable().default(null),
  amountPaid: z.coerce.number().nullable().default(null),
  paymentMethods: z.array(z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"])).default([]),
});
export type ReceiptExtractResult = z.infer<typeof receiptExtractSchema>;
