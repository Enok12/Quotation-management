"use client";

import { Lock, LockOpen, Loader2, Save } from "lucide-react";
import { fmtMoney } from "@/lib/utils/format";
import { useExpenseEditor, type ExpenseRecordValues } from "./use-expense-editor";

interface Props {
  receiptId: string;
  billAmount: number;
  initial: ExpenseRecordValues | null;
  isAdmin: boolean;
}

// Card-style editor for the receipt detail page's Expenses section: the four
// cost fields, an auto-calculated (but editable) Profit field, and a
// Finalize/Unlock action. Locked once finalized.
export function ExpenseEditorCard({ receiptId, billAmount, initial, isAdmin }: Props) {
  const e = useExpenseEditor(receiptId, billAmount, initial);
  const disabled = e.finalized || e.saving;

  const field = (label: string, value: string, onChange: (v: string) => void) => (
    <div>
      <label className="field-label">{label}</label>
      <input
        type="number" min="0" step="0.01" value={value} placeholder="0.00"
        disabled={disabled}
        onChange={(ev) => onChange(ev.target.value)}
        className="field-input text-sm disabled:bg-stone-100 disabled:text-stone-400 dark:disabled:bg-stone-700 dark:disabled:text-stone-500"
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-stone-500">Bill Amount</span>
        <span className="font-mono font-semibold">{fmtMoney(billAmount)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field("Fabric Expense", e.fabricExpense, e.setFabricExpense)}
        {field("Sewing Expense", e.sewingExpense, e.setSewingExpense)}
        {field("Accessory Expense", e.accessoryExpense, e.setAccessoryExpense)}
        {field("Other Expense", e.otherExpense, e.setOtherExpense)}
      </div>

      <div>
        <label className="field-label">Profit</label>
        <input
          type="number" step="0.01" value={e.profit} placeholder="0.00"
          disabled={disabled}
          onChange={(ev) => e.onProfitChange(ev.target.value)}
          className="field-input text-sm font-semibold disabled:bg-stone-100 disabled:text-stone-400 dark:disabled:bg-stone-700 dark:disabled:text-stone-500"
        />
        <p className="text-xs text-stone-400 mt-1">Auto-calculated from Bill Amount minus costs — edit to override.</p>
      </div>

      {e.error && <p className="text-xs text-red-500">{e.error}</p>}

      <div className="flex items-center gap-2">
        {!e.finalized && (
          <button type="button" onClick={e.save} disabled={e.saving} className="btn-outline text-xs py-1.5 flex-1">
            {e.saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {e.saving ? "Saving…" : "Save"}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={e.toggleFinalize}
            disabled={e.finalizing}
            className={e.finalized ? "btn-ghost text-xs py-1.5 flex-1" : "btn-amber text-xs py-1.5 flex-1"}
          >
            {e.finalizing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : e.finalized ? (
              <LockOpen size={13} />
            ) : (
              <Lock size={13} />
            )}
            {e.finalizing ? "Working…" : e.finalized ? "Unlock" : "Finalize"}
          </button>
        )}
      </div>

      {e.finalized && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <Lock size={11} /> Finalized — included in the Income statement.
        </p>
      )}
      {!e.finalized && !isAdmin && (
        <p className="text-xs text-stone-400">Only an admin can finalize this record.</p>
      )}
    </div>
  );
}
