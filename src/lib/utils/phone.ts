// Phone helpers for the Retail COD flow. Sri Lanka (94) is the business's
// market, matching send-whatsapp-button.tsx: a local number written with a
// leading 0 is treated as 94-prefixed.

/**
 * Digits only, in international form without "+" — what both wa.me links and
 * the frequent-refuser lookup need. So "0771234567", "+94771234567",
 * "94 77 123 4567" and "077-123-4567" all come out as "94771234567".
 * Returns "" when there is nothing usable.
 */
export function normalizePhone(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2); // 0094… dialled form
  if (d.startsWith("0")) d = "94" + d.slice(1); // local 0xx… form
  else if (d.length === 9) d = "94" + d; // 771234567 — local number typed without the 0
  return d;
}

/** wa.me link that opens a chat with `phone` (or the contact picker if blank) with `text` prefilled. */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const num = normalizePhone(phone);
  return `${num ? `https://wa.me/${num}` : "https://wa.me/"}?text=${encodeURIComponent(text)}`;
}
