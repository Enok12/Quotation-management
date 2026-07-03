"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { receiptFileName } from "@/lib/utils/receipt-filename";

export function GeneratePdfButton({
  receiptId, receiptNumber, custName,
}: { receiptId: string; receiptNumber: number; custName: string }) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}/generate-pdf`, { method: "POST" });
      if (!res.ok) { alert("PDF generation failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = receiptFileName(receiptNumber, custName);
      a.click(); URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  };

  return (
    <button onClick={generate} disabled={loading} className="btn-outline">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
      {loading ? "Generating…" : "PDF"}
    </button>
  );
}
