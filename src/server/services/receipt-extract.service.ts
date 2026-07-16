import { AppError } from "@/lib/api/errors";
import { receiptExtractSchema, type ReceiptExtractResult } from "@/lib/validation/receipt-extract.schema";

// "gemini-2.0-flash" returns 0 free-tier quota on this project — the
// "-latest" alias resolves to whichever current model actually has quota
// available, verified working (including image input) at integration time.
const MODEL = "gemini-flash-lite-latest";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Describes MONTRA's own fixed receipt layout so the model can map regions of
// the photo (or PDF page) to fields instead of guessing at an unfamiliar
// format. Also covers the multi-page-PDF case: some uploads are a PDF where
// the first pages are unrelated Terms & Conditions and the actual receipt is
// further in (often the last page) — the model is told to locate that page
// itself rather than assume page 1.
const PROMPT = `You are reading a photo or PDF of a printed business receipt from "MONTRA", a clothing manufacturer.

If this is a multi-page PDF, the receipt is not necessarily on the first page — earlier pages may be unrelated Terms & Conditions or other content. Scan every page and find the one that matches this layout, then extract only from that page:
- A header line "Date: DD/MM/YYYY".
- A two-column table: the left side is "CUSTOMER DETAILS" (rows: Name, Address, Phone, Email), the right side is "PAYMENT INFORMATION" (rows: Cash, Debit/Credit Card, Bank Transfer, Other — each has a checkmark if that method was used).
- An items table with columns Qty, Description, Unit Price, Total.
- Below the items, summary rows for any extra adjustment (e.g. a discount or a named deduction), then "Total Due", "Advance Payment", "Amount Paid", "Balance".

If no page matches this layout, return every field as null/empty rather than guessing from an unrelated page.

Read the matching page and return ONLY a JSON object with this exact shape (no prose, no markdown fences):
{
  "customerName": string or null,
  "address": string or null,
  "phone": string or null,
  "email": string or null,
  "date": string or null (as YYYY-MM-DD if you can determine it),
  "items": [{ "description": string, "quantity": number, "unitPrice": number }],
  "adjustments": [{ "label": string, "amount": number }] (any extra named row before Total Due that is NOT Total Due/Advance Payment/Amount Paid/Balance),
  "advanceAmount": number or null,
  "amountPaid": number or null,
  "paymentMethods": string[] (any of "CASH", "CARD", "BANK_TRANSFER", "OTHER" — only include ones that have a checkmark),
  "category": "MEN" or "WOMEN" or null (infer from the item descriptions only, e.g. "Men's Shirt"/"Trouser" suggest MEN, "Ladies Blouse"/"Frock"/"Saree" suggest WOMEN — use null if the descriptions don't clearly indicate either)
}

If a field isn't legible or isn't present, use null (or an empty array for lists) rather than guessing. Do not invent values — this applies to every field except "category", which is explicitly an inference from the item text, not a printed value.`;

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
}

export const receiptExtractService = {
  // apiKey: the calling business's own Gemini key (decrypted by the caller).
  // There is no shared fallback — each business must configure its own key
  // in Settings before this feature works; the caller (the extract route)
  // is responsible for checking that and failing with a clear message before
  // ever reaching here.
  async extract(imageBase64: string, mimeType: string, apiKey: string): Promise<ReceiptExtractResult> {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    const json: GeminiResponse = await res.json();
    if (!res.ok) {
      throw new AppError(json.error?.message ?? "Couldn't read that receipt image. Please try again.", 502);
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AppError("Couldn't read that receipt image. Please try again.", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AppError("Couldn't make sense of that receipt image. Please fill it in manually.", 502);
    }

    const result = receiptExtractSchema.safeParse(parsed);
    if (!result.success) {
      throw new AppError("Couldn't make sense of that receipt image. Please fill it in manually.", 502);
    }
    return result.data;
  },
};
