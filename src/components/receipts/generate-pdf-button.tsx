"use client";
import { useState } from "react";
import { FileDown } from "lucide-react";

export function GeneratePdfButton({ receiptId, receiptNumber }: { receiptId: string; receiptNumber: number }) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}/generate-pdf`, { method: "POST" });
      if (!res.ok) { alert("PDF generation failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `receipt-${receiptNumber}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  };

  return (
    <button onClick={generate} disabled={loading} className="btn-outline">
      <FileDown size={14} /> {loading ? "Generating…" : "PDF"}
    </button>
  );
}
