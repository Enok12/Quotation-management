"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { receiptFileName, draftReceiptFileName } from "@/lib/utils/receipt-filename";
import type { ReceiptOrderType } from "@/lib/utils/receipt-number";

export function GeneratePdfButton({
  receiptId, receiptNumber, custName, orderType,
}: { receiptId: string; receiptNumber: number | null; custName: string; orderType: ReceiptOrderType }) {
  const [loading, setLoading] = useState(false);
  const isDraft = receiptNumber === null;

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}/generate-pdf`, { method: "POST" });
      if (!res.ok) { alert("PDF generation failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = isDraft ? draftReceiptFileName(receiptId, custName) : receiptFileName(receiptNumber, custName, orderType);
      a.click(); URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  };

  return (
    <button onClick={generate} disabled={loading} className="btn-outline">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
      {loading ? "Generating…" : isDraft ? "Draft PDF" : "PDF"}
    </button>
  );
}
