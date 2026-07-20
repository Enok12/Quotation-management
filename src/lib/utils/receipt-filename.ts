// Shared filename builder for receipt PDFs — used by the download button, the
// server's Content-Disposition header, and the computer folder sync, so every
// place a receipt PDF gets a name agrees on the same format:
//   ReceiptNumber-Customer_Name.pdf

// Strip characters invalid in Windows/macOS filenames, collapse whitespace to
// underscores, and cap the length.
export function sanitizeForFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return cleaned.slice(0, 60) || "Customer";
}

export function receiptFileName(receiptNumber: number, custName: string): string {
  return `${receiptNumber}-${sanitizeForFilename(custName)}.pdf`;
}

// Unconfirmed orders have no invoice number yet, so their draft PDF is keyed
// by the receipt's own id instead — used only in the Unconfirmed folder.
export function draftReceiptFileName(receiptId: string, custName: string): string {
  return `${sanitizeForFilename(custName)}-draft-${receiptId}.pdf`;
}
