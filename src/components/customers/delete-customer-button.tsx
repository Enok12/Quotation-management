"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X, AlertTriangle } from "lucide-react";
import { removeInvoiceFromFolders } from "@/lib/folder-sync";
import type { ReceiptOrderType } from "@/lib/utils/receipt-number";

// Deletes a customer. Warns up front that this also permanently deletes all
// of their receipts (and each receipt's items/payments/history), then cleans
// up those receipts' PDFs from the connected computer folder on success.
export function DeleteCustomerButton({
  customerId,
  customerName,
  receiptCount,
  iconOnly = false,
}: {
  customerId: string;
  customerName: string;
  receiptCount: number;
  /** Render a compact icon-only trigger (e.g. for a dense table row) instead
   * of the full labeled button. The confirmation dialog is unchanged. */
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const del = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to delete customer");

      const receipts: { id: string; receiptNumber: number | null; orderType: ReceiptOrderType }[] = json.data?.receipts ?? [];
      await Promise.all(receipts.map((r) => removeInvoiceFromFolders(r.id, r.receiptNumber, r.orderType)));

      router.push("/dashboard/customers");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete customer");
      setLoading(false);
    }
  };

  return (
    <>
      {iconOnly ? (
        <button
          onClick={() => setOpen(true)}
          title="Delete customer"
          aria-label="Delete customer"
          className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-danger">
          <Trash2 size={14} /> Delete Customer
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => !loading && setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-sm p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-serif text-xl text-ink">Delete {customerName}?</h3>
              <button onClick={() => !loading && setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2.5 mb-4">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-none" />
              <p className="text-sm text-red-700 dark:text-red-400">
                {receiptCount > 0
                  ? <>This will also permanently delete <strong>{receiptCount} receipt{receiptCount === 1 ? "" : "s"}</strong> belonging to this customer, including their items, payments, and history.</>
                  : "This customer has no receipts yet."}
                {" "}This cannot be undone.
              </p>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2 mb-4">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} disabled={loading} className="btn-ghost">Cancel</button>
              <button onClick={del} disabled={loading} className="btn-danger">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {loading ? "Deleting…" : "Delete Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
