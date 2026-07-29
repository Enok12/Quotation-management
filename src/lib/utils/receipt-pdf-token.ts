import { createHmac, timingSafeEqual } from "node:crypto";

// A stateless, unguessable authorization for the PUBLIC receipt-PDF link
// (the one dropped into a WhatsApp message). Instead of storing a token per
// receipt, the receipt id is signed with the app's existing
// SECRET_ENCRYPTION_KEY — anyone holding a valid (id, sig) pair can fetch that
// one receipt's PDF, and the signature can't be forged without the key.
//
// This is intentionally NOT the same as the tracking token: tracking is
// bulk-only and shows live order status; this works for every receipt type
// and returns the exact invoice document.

function key(): Buffer {
  const b64 = process.env.SECRET_ENCRYPTION_KEY;
  if (!b64) throw new Error("SECRET_ENCRYPTION_KEY is not configured");
  return Buffer.from(b64, "base64");
}

// Domain-separated so a receipt-id signature can never be mistaken for, or
// replayed as, a signature this key produces for any other purpose.
const SCOPE = "receipt-pdf:";

export function signReceiptId(receiptId: string): string {
  return createHmac("sha256", key()).update(SCOPE + receiptId).digest("base64url");
}

export function verifyReceiptId(receiptId: string, signature: string): boolean {
  if (!receiptId || !signature) return false;
  const expected = signReceiptId(receiptId);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // Length check first: timingSafeEqual throws on a length mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}
