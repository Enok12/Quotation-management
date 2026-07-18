"use client";

import { forwardRef, useImperativeHandle } from "react";
import Link from "next/link";
import { Lock, LockOpen, Loader2, Save } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { useExpenseEditor, type ExpenseRecordValues, type ExpenseCostTotals } from "./use-expense-editor";

interface Props {
  receiptId: string;
  receiptNumber: number;
  custName: string;
  date: string | Date;
  billAmount: number;
  totalQuantity: number;
  initial: ExpenseRecordValues | null;
  isAdmin: boolean;
  /** Bulk rows show all six cost cells; Sample rows only fabric/pattern
   * making/production — must match whichever <thead> the parent renders. */
  orderType: "BULK" | "SAMPLE";
  onSaved?: (values: ExpenseCostTotals) => void;
  onFinalizedChange?: (finalized: boolean) => void;
  /** This row's position in the currently-rendered page — stamped onto each
   * editable cell as `data-cell="{rowIndex}:{col}"` so ExpensesTable's arrow-key
   * handler can look up the neighboring cell to focus. */
  rowIndex: number;
  selected: boolean;
  onToggleSelected: () => void;
}

// Imperative surface ExpensesTable uses to drive Bulk Save / Bulk Finalize —
// each row keeps owning its own cost-field state privately (so an unrelated
// row's bulk action can never stomp on what this row has typed but not yet
// saved), but exposes a way to trigger its own save/finalize on command.
export interface ExpenseRowHandle {
  save: () => Promise<boolean>;
  finalizeIfNeeded: () => Promise<boolean>;
  finalized: boolean;
}

// One editable row in the global Expenses table: order-type-appropriate cost
// cells, an auto-calculated (but overridable) Profit cell, and a
// Finalize/Unlock cell. Locked once finalized.
export const ExpenseRow = forwardRef<ExpenseRowHandle, Props>(function ExpenseRow(
  { receiptId, receiptNumber, custName, date, billAmount, totalQuantity, initial, isAdmin, orderType, onSaved, onFinalizedChange, rowIndex, selected, onToggleSelected },
  ref,
) {
  const e = useExpenseEditor(receiptId, billAmount, initial, onSaved, onFinalizedChange);
  const disabled = e.finalized || e.saving;

  useImperativeHandle(ref, () => ({
    save: e.save,
    finalizeIfNeeded: () => (e.finalized ? Promise.resolve(true) : e.toggleFinalize()),
    finalized: e.finalized,
  }));

  // Profit and Finalize are pinned to the right edge of the scrollable table
  // (see the sticky classes below) so they stay visible while scrolling
  // through the cost columns on narrower screens — they need an opaque
  // background matching the row's state, or whatever scrolls underneath
  // would show through.
  const stickyBg = e.finalized ? "bg-emerald-50 dark:bg-emerald-950" : "bg-white dark:bg-stone-800";

  const cellInput = (value: string, onChange: (v: string) => void, col: string) => (
    <input
      type="number" min="0" step="0.01" value={value} placeholder="0.00"
      disabled={disabled}
      data-cell={`${rowIndex}:${col}`}
      onChange={(ev) => onChange(ev.target.value)}
      className="w-24 px-2 py-1 text-xs text-right bg-transparent border border-transparent rounded hover:border-stone-200 dark:hover:border-stone-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors disabled:text-stone-400 dark:disabled:text-stone-500"
    />
  );

  return (
    <tr className={e.finalized ? "bg-emerald-25 dark:bg-emerald-500/[0.03]" : undefined}>
      <td className="td w-10">
        <input
          type="checkbox" checked={selected} disabled={e.finalized}
          onChange={onToggleSelected}
          aria-label={`Select receipt #${receiptNumber}`}
          className="accent-amber-600 disabled:opacity-30"
        />
      </td>
      <td className="td text-stone-500 text-xs whitespace-nowrap">{fmtDate(date)}</td>
      <td className="td">
        <Link href={`/dashboard/receipts/${receiptId}`} className="text-xs hover:text-amber-600 transition-colors">
          <span className="font-mono text-stone-500">#{receiptNumber}</span>
          <span className="text-stone-400"> · {custName}</span>
        </Link>
      </td>
      <td className="td text-right font-mono text-sm">{fmtMoney(billAmount)}</td>
      <td className="td text-right font-mono text-sm text-stone-500">{totalQuantity.toLocaleString()}</td>
      <td className="td text-right">{cellInput(e.fabricExpense, e.setFabricExpense, "fabricExpense")}</td>
      <td className="td text-right">{cellInput(e.patternMakingExpense, e.setPatternMakingExpense, "patternMakingExpense")}</td>
      {orderType === "BULK" && <td className="td text-right">{cellInput(e.cuttingExpense, e.setCuttingExpense, "cuttingExpense")}</td>}
      <td className="td text-right">{cellInput(e.productionExpense, e.setProductionExpense, "productionExpense")}</td>
      {orderType === "BULK" && <td className="td text-right">{cellInput(e.accessoryExpense, e.setAccessoryExpense, "accessoryExpense")}</td>}
      {orderType === "BULK" && <td className="td text-right">{cellInput(e.otherExpense, e.setOtherExpense, "otherExpense")}</td>}
      <td className={`td text-right sticky right-20 z-10 w-28 border-l border-stone-100 dark:border-stone-700 ${stickyBg}`}>
        <input
          type="number" step="0.01" value={e.profit} placeholder="0.00"
          disabled={disabled}
          data-cell={`${rowIndex}:profit`}
          onChange={(ev) => e.onProfitChange(ev.target.value)}
          className="w-24 px-2 py-1 text-xs text-right font-semibold bg-transparent border border-transparent rounded hover:border-stone-200 dark:hover:border-stone-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors disabled:text-stone-400 dark:disabled:text-stone-500"
        />
      </td>
      <td className={`td sticky right-0 z-10 w-20 ${stickyBg}`}>
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
});
