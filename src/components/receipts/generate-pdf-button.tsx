import { FileDown } from "lucide-react";
import type { ReceiptOrderType } from "@/lib/utils/receipt-number";

// Opens the receipt PDF in a new tab via a top-level GET navigation, rather
// than fetching a blob and triggering an <a download>. The blob-download
// approach is silently ignored by iOS Safari (and unreliable on Android), so
// the button appeared to do nothing on phones. Opening the PDF in the
// browser's own viewer works everywhere — the user can then save or share it
// with the native controls.
//
// A plain <a target="_blank"> (not window.open) is used deliberately: it's
// immune to mobile popup blockers and needs no JavaScript to fire.
export function GeneratePdfButton({
  receiptId, receiptNumber,
}: { receiptId: string; receiptNumber: number | null; custName: string; orderType: ReceiptOrderType }) {
  const isDraft = receiptNumber === null;

  return (
    <a
      href={`/api/v1/receipts/${receiptId}/generate-pdf`}
      target="_blank"
      rel="noopener"
      className="btn-outline"
    >
      <FileDown size={14} />
      {isDraft ? "Draft PDF" : "PDF"}
    </a>
  );
}
