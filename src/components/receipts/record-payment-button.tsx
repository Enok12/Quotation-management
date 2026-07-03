"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, X, Loader2 } from "lucide-react";
import { moveInvoiceIfConnected } from "@/lib/folder-sync";
import { deriveFolder } from "@/lib/order-folder";

const METHODS = [
  { value: "", label: "—" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Debit/Credit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
];

export function RecordPaymentButton({
  receiptId,
  receiptNumber,
  custName,
  totalDue,
  advanceAmount = 0,
  amountPaid = 0,
  orderType = "BULK",
}: {
  receiptId: string;
  receiptNumber: number;
  custName: string;
  totalDue: number;
  advanceAmount?: number;
  amountPaid?: number;
  orderType?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remaining advance still to be collected (advance is a target, paid is real).
  const advanceRemaining = Math.max(0, Math.round((advanceAmount - amountPaid) * 100) / 100);
  // True amount still needed to fully settle the invoice — NOT the receipt's
  // printed "Balance" (which reserves the advance from day one and can read
  // lower than what's actually been collected so far).
  const remaining = Math.max(0, Math.round((totalDue - amountPaid) * 100) / 100);

  const submit = async () => {
    setError(null);
    const value = Number(amount);
    if (!(value > 0)) { setError("Enter an amount greater than zero."); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, method: method || null, note: note || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to record payment");

      // Mirror the invoice into its new computer folder (no-op if not connected).
      await moveInvoiceIfConnected(receiptId, receiptNumber, custName, deriveFolder(orderType, json.data.paymentStatus));

      setOpen(false);
      setAmount(""); setMethod(""); setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-amber">
        <Wallet size={14} /> Record Payment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl text-ink">Record a payment</h3>
                <p className="text-sm text-stone-500 mt-0.5">Receipt #{receiptNumber} · {remaining.toLocaleString()} still due</p>
              </div>
              <button onClick={() => !saving && setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="field-label">Amount *</label>
                <input
                  type="number" min="0" step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="field-input" placeholder="0.00" autoFocus
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {advanceRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(advanceRemaining))}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Pay advance ({advanceRemaining.toLocaleString()})
                    </button>
                  )}
                  {remaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(String(remaining))}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Pay full balance ({remaining.toLocaleString()})
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="field-label">Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="field-input">
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Note</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} className="field-input" placeholder="e.g. Advance, instalment 2…" />
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

              <button onClick={submit} disabled={saving} className="btn-primary w-full">
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
