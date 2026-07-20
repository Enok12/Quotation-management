import { z } from "zod";

// Gemini is told to return plain numbers, but a vision model reading a
// printed amount (e.g. "41,000") sometimes echoes the visual formatting back
// as a comma-grouped string instead — which plain z.coerce.number() can't
// parse (Number("41,000") is NaN, and zod rejects NaN as an invalid number).
// Since every amount on a MONTRA receipt is rendered comma-grouped once it
// reaches four digits, this isn't an edge case — strip thousands separators
// before coercing so a genuinely-unparsable value still fails validation
// instead of one that was just formatted.
const looseNumber = z.preprocess((val) => {
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").trim();
    const n = Number(cleaned);
    if (!Number.isNaN(n) && cleaned !== "") return n;
  }
  return val;
}, z.coerce.number());

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
        quantity: looseNumber.pipe(z.number().nonnegative()),
        unitPrice: looseNumber.pipe(z.number().nonnegative()),
      }),
    )
    .default([]),
  adjustments: z
    .array(z.object({ label: z.string(), amount: looseNumber }))
    .default([]),
  advanceAmount: looseNumber.nullable().default(null),
  amountPaid: looseNumber.nullable().default(null),
  paymentMethods: z.array(z.enum(["CASH", "CARD", "BANK_TRANSFER", "OTHER"])).default([]),
  // Best-effort guess from the item descriptions (e.g. "Men's Shirt" vs
  // "Ladies Blouse") — null when it can't be confidently inferred. Never
  // trusted enough to skip the staff review step; just a head start.
  category: z.enum(["MEN", "WOMEN"]).nullable().default(null),
});
export type ReceiptExtractResult = z.infer<typeof receiptExtractSchema>;
