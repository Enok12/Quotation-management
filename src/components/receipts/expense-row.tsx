"use client";

import Link from "next/link";
import { Lock, LockOpen, Loader2, Save } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { useExpenseEditor, type ExpenseRecordValues } from "./use-expense-editor";

interface Props {
  receiptId: string;
  receiptNumber: number;
  custName: string;
  date: string | Date;
  billAmount: number;
  initial: ExpenseRecordValues | null;
  isAdmin: boolean;
}

// One editable row in the global Expenses table: four cost cells, an
// auto-calculated (but overridable) Profit cell, and a Finalize/Unlock cell.
// Locked once finalized.
export function ExpenseRow({ receiptId, receiptNumber, custName, date, billAmount, initial, isAdmin }: Props) {
  const e = useExpenseEditor(receiptId, billAmount, initial);
  const disabled = e.finalized || e.saving;

  const cellInput = (value: string, onChange: (v: string) => void) => (
    <input
      type="number" min="0" step="0.01" value={value} placeholder="0.00"
      disabled={disabled}
      onChange={(ev) => onChange(ev.target.value)}
      className="w-24 px-2 py-1 text-xs text-right bg-transparent border border-transparent rounded hover:border-stone-200 dark:hover:border-stone-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors disabled:text-stone-400 dark:disabled:text-stone-500"
    />
  );

  return (
    <tr className={e.finalized ? "bg-emerald-25 dark:bg-emerald-500/[0.03]" : undefined}>
      <td className="td text-stone-500 text-xs whitespace-nowrap">{fmtDate(date)}</td>
      <td className="td">
        <Link href={`/dashboard/receipts/${receiptId}`} className="text-xs hover:text-amber-600 transition-colors">
          <span className="font-mono text-stone-500">#{receiptNumber}</span>
          <span className="text-stone-400"> · {custName}</span>
        </Link>
      </td>
      <td className="td text-right font-mono text-sm">{fmtMoney(billAmount)}</td>
      <td className="td text-right">{cellInput(e.fabricExpense, e.setFabricExpense)}</td>
      <td className="td text-right">{cellInput(e.sewingExpense, e.setSewingExpense)}</td>
      <td className="td text-right">{cellInput(e.accessoryExpense, e.setAccessoryExpense)}</td>
      <td className="td text-right">{cellInput(e.otherExpense, e.setOtherExpense)}</td>
      <td className="td text-right">
        <input
          type="number" step="0.01" value={e.profit} placeholder="0.00"
          disabled={disabled}
          onChange={(ev) => e.onProfitChange(ev.target.value)}
          className="w-24 px-2 py-1 text-xs text-right font-semibold bg-transparent border border-transparent rounded hover:border-stone-200 dark:hover:border-stone-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors disabled:text-stone-400 dark:disabled:text-stone-500"
        />
      </td>
      <td className="td">
        <div className="flex items-center justify-center gap-1.5">
          {!e.finalized && (
            <button
              type="button" onClick={e.save} disabled={e.saving}
              title="Save" aria-label="Save"
              className="text-stone-300 hover:text-amber-600 dark:text-stone-600 dark:hover:text-amber-400 transition-colors p-1"
            >
              {e.saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            </button>
          )}
          {isAdmin && (
            <button
              type="button" onClick={e.toggleFinalize} disabled={e.finalizing}
              title={e.finalized ? "Unlock" : "Finalize"} aria-label={e.finalized ? "Unlock" : "Finalize"}
              className={
                e.finalized
                  ? "text-emerald-500 hover:text-emerald-600 transition-colors p-1"
                  : "text-stone-300 hover:text-emerald-600 dark:text-stone-600 dark:hover:text-emerald-400 transition-colors p-1"
              }
            >
              {e.finalizing ? <Loader2 size={14} className="animate-spin" /> : e.finalized ? <LockOpen size={14} /> : <Lock size={14} />}
            </button>
          )}
        </div>
        {e.error && <p className="text-[10px] text-red-500 text-center mt-0.5">{e.error}</p>}
      </td>
    </tr>
  );
}
