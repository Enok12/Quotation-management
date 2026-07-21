"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Loader2 } from "lucide-react";
import { moveInvoiceIfConnected } from "@/lib/folder-sync";
import { deriveFolder } from "@/lib/order-folder";

// Creates a new bulk order cloned from an approved sample — the sample
// itself is left untouched in Sample Orders — then opens the new receipt
// so staff can set the real bulk quantities.
export function ConvertToBulkButton({ receiptId, custName }: { receiptId: string; custName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const convert = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}/convert`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to create bulk order");
      const { id: newId, receiptNumber: newNumber, paymentStatus, category } = json.data;
      // The new bulk order starts Unconfirmed — this places its draft in the
      // Unconfirmed folder until the advance is paid.
      await moveInvoiceIfConnected(newId, newNumber, custName, "BULK", category, deriveFolder("BULK", paymentStatus, newNumber));
      router.push(`/dashboard/receipts/${newId}/edit`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create bulk order");
      setLoading(false);
    }
  };

  return (
    <button onClick={convert} disabled={loading} className="btn bg-blue-600 text-white hover:bg-blue-500">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Boxes size={14} />}
      Create Bulk Order
    </button>
  );
}
