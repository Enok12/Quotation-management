// Bulk and Sample orders run as two independent invoice sequences, so Bulk #1
// and Sample #1 are different orders that both legitimately exist. Everything
// that shows or stores an invoice number goes through here so the two can
// always be told apart — on screen, on the PDF, and in synced filenames.
//
// Only Samples carry a marker. Bulk keeps bare numbers exactly as before this
// split existed, so every already-issued bulk invoice still matches the paper
// copy the customer holds.

export type ReceiptOrderType = "BULK" | "SAMPLE";

export const SAMPLE_PREFIX = "S-";
/** Samples pad to two digits ("S-01"); a sequence past 99 just grows ("S-100"). */
export const SAMPLE_PAD = 2;

/**
 * Bare, filename-safe form: `24` for Bulk, `S-01` for Sample.
 * Used to build PDF filenames — no "#", which isn't safe/clean in a filename.
 */
export function receiptNumberSlug(receiptNumber: number, orderType: ReceiptOrderType): string {
  return orderType === "SAMPLE"
    ? `${SAMPLE_PREFIX}${String(receiptNumber).padStart(SAMPLE_PAD, "0")}`
    : String(receiptNumber);
}

/**
 * Display form: `#24` for Bulk, `S-01` for Sample. A Sample's "S-" already
 * marks it as an invoice number, so it doesn't also take a "#".
 */
export function receiptNumberLabel(receiptNumber: number, orderType: ReceiptOrderType): string {
  return orderType === "SAMPLE" ? receiptNumberSlug(receiptNumber, orderType) : `#${receiptNumber}`;
}

/**
 * Same, but tolerates the not-yet-confirmed case (receiptNumber still null),
 * which is most of the list views.
 */
export function receiptNumberLabelOr(
  receiptNumber: number | null,
  orderType: ReceiptOrderType,
  fallback = "Unconfirmed",
): string {
  return receiptNumber === null ? fallback : receiptNumberLabel(receiptNumber, orderType);
}
