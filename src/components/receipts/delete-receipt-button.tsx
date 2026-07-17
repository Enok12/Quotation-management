"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { removeInvoiceFromFolders } from "@/lib/folder-sync";

// Delete a receipt (e.g. a rejected sample). Confirms first, then removes its
// PDF from the computer folder.
export function DeleteReceiptButton({
  receiptId,
  receiptNumber,
  iconOnly = false,
}: {
  receiptId: string;
  receiptNumber: number | null;
  /** Render a compact icon-only trigger (e.g. for a dense table row) instead
   * of the full labeled button. Skips the redirect-to-list navigation, since
   * the caller is already on a list page. */
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const del = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to delete");
      // Unconfirmed receipts never had a PDF placed anywhere.
      if (receiptNumber !== null) await removeInvoiceFromFolders(receiptNumber);
      if (!iconOnly) router.push("/dashboard/receipts");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
      setLoading(false);
    }
  };

  return (
    <>
      {iconOnly ? (
        <button
          onClick={() => setOpen(true)}
          title="Delete receipt"
          aria-label="Delete receipt"
          className="text-stone-300 hover:text-red-500 dark:text-stone-600 dark:hover:text-red-400 transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-danger">
          <Trash2 size={14} /> Delete
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => !loading && setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-sm p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-serif text-xl text-ink">
                Delete {receiptNumber !== null ? `receipt #${receiptNumber}` : "this unconfirmed order"}?
              </h3>
              <button onClick={() => !loading && setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>
            <p className="text-sm text-stone-500 mb-5">
              This permanently removes the receipt, its items, payments and history, and deletes its PDF from the
              connected computer folder. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} disabled={loading} className="btn-ghost">Cancel</button>
              <button onClick={del} disabled={loading} className="btn-danger">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
