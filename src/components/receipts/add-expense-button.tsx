"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, Banknote } from "lucide-react";

// Records an expense against a receipt — description + amount only.
export function AddExpenseButton({
  receiptId,
  iconOnly = false,
}: {
  receiptId: string;
  /** Render a compact icon-only trigger (e.g. for a dense table row) instead
   * of the full labeled button. The dialog itself is unchanged. */
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!description.trim()) { setError("Enter a description."); return; }
    const value = Number(amount);
    if (!(value > 0)) { setError("Enter an amount greater than zero."); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), amount: value }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to record expense");

      setOpen(false);
      setDescription(""); setAmount("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {iconOnly ? (
        <button
          onClick={() => setOpen(true)}
          title="Add expense"
          aria-label="Add expense"
          className="text-stone-300 hover:text-amber-500 dark:text-stone-600 dark:hover:text-amber-400 transition-colors p-1"
        >
          <Banknote size={14} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-ghost text-xs py-1">
          <Plus size={12} /> Add Expense
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-sm p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Add expense</h3>
              <button onClick={() => !saving && setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="field-label">Description *</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="field-input" placeholder="e.g. Fabric purchase" autoFocus
                />
              </div>
              <div>
                <label className="field-label">Amount *</label>
                <input
                  type="number" min="0" step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="field-input" placeholder="0.00"
                />
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded px-3 py-2">{error}</p>}

              <button onClick={submit} disabled={saving} className="btn-primary w-full">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Saving…" : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
