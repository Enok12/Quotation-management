"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

export function FinalizeButton({ receiptId }: { receiptId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const finalize = async () => {
    if (!confirm("Finalize this receipt? It will be locked and an order will be created.")) return;
    setLoading(true);
    const res = await fetch(`/api/v1/receipts/${receiptId}/finalize`, { method: "POST" });
    const json = await res.json();
    if (json.success) { router.refresh(); } else { alert(json.message); setLoading(false); }
  };

  return (
    <button onClick={finalize} disabled={loading} className="btn-amber">
      <CheckCircle size={14} /> {loading ? "Finalizing…" : "Finalize"}
    </button>
  );
}
