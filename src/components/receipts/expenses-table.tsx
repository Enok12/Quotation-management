"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { fmtMoney } from "@/lib/utils/format";
import { ExpenseRow, type ExpenseRowHandle } from "./expense-row";
import type { ExpenseRecordValues, ExpenseCostTotals } from "./use-expense-editor";

export interface ExpenseTotals {
  bill: number;
  quantity: number;
  fabric: number;
  patternMaking: number;
  cutting: number;
  production: number;
  accessory: number;
  other: number;
  profit: number;
}

interface RowData {
  id: string;
  receiptNumber: number;
  custName: string;
  date: string;
  billAmount: number;
  totalQuantity: number;
  initial: ExpenseRecordValues | null;
}

interface Props {
  rows: RowData[];
  orderType: "BULK" | "SAMPLE";
  isAdmin: boolean;
  colSpan: number;
  /** Grand total across every matching receipt MINUS the rows on this page —
   * a fixed baseline computed server-side, since only this page's rows are
   * ever live-edited here without a full reload. */
  otherPagesTotals: ExpenseTotals;
}

// Mirrors the exact box model (width/padding/border) of the editable cost
// cells in each row (see ExpenseRow's cellInput) — a plain text node here
// would sit at a different inset than an <input>'s own internal padding, so
// the Total row's digits wouldn't line up with the values above it.
// pointer-events-none (plus tabIndex=-1) keeps it inert: a readOnly input is
// still focusable/clickable by default, which would otherwise pick up the
// site-wide focus ring and text-selection highlight on click, looking like
// an editable field it isn't.
function totalCell(value: number) {
  return (
    <input
      type="text" readOnly tabIndex={-1} value={fmtMoney(value)}
      className="w-24 px-2 py-1 text-xs text-right bg-transparent border border-transparent rounded outline-none pointer-events-none select-none"
    />
  );
}

// Editable columns in on-screen order — Sample rows omit cutting/accessory/
// other. Drives arrow-key navigation: Up/Down move within a column, Left/
// Right move within a row, both wrapping at the table's edges (no-op there).
function editableColumns(orderType: "BULK" | "SAMPLE"): string[] {
  return orderType === "BULK"
    ? ["fabricExpense", "patternMakingExpense", "cuttingExpense", "productionExpense", "accessoryExpense", "otherExpense", "profit"]
    : ["fabricExpense", "patternMakingExpense", "productionExpense", "profit"];
}

// Owns the live (not-yet-refreshed) state of every row's saved cost values,
// so the totals footer updates the instant any row saves — without a
// router.refresh(), which would re-render every sibling row from the server
// and discard whatever anyone else had typed but not yet saved. Also owns
// row selection and drives Bulk Save / Bulk Finalize by calling each
// selected row's own imperative save()/finalizeIfNeeded() in parallel.
export function ExpensesTable({ rows, orderType, isAdmin, colSpan, otherPagesTotals }: Props) {
  const [savedByRow, setSavedByRow] = useState<Record<string, ExpenseCostTotals>>(() => {
    const map: Record<string, ExpenseCostTotals> = {};
    for (const r of rows) {
      map[r.id] = r.initial
        ? {
            fabricExpense: r.initial.fabricExpense,
            patternMakingExpense: r.initial.patternMakingExpense,
            cuttingExpense: r.initial.cuttingExpense,
            productionExpense: r.initial.productionExpense,
            accessoryExpense: r.initial.accessoryExpense,
            otherExpense: r.initial.otherExpense,
            profit: r.initial.profit,
          }
        : {
            fabricExpense: 0, patternMakingExpense: 0, cuttingExpense: 0,
            productionExpense: 0, accessoryExpense: 0, otherExpense: 0,
            profit: r.billAmount,
          };
    }
    return map;
  });

  const [finalizedByRow, setFinalizedByRow] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.initial?.finalized ?? false])),
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState<"save" | "finalize" | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, ExpenseRowHandle>());

  const totals = useMemo(() => {
    const t = { ...otherPagesTotals };
    for (const r of rows) {
      const v = savedByRow[r.id];
      t.bill += r.billAmount;
      t.quantity += r.totalQuantity;
      t.fabric += v.fabricExpense;
      t.patternMaking += v.patternMakingExpense;
      t.cutting += v.cuttingExpense;
      t.production += v.productionExpense;
      t.accessory += v.accessoryExpense;
      t.other += v.otherExpense;
      t.profit += v.profit;
    }
    return t;
  }, [rows, savedByRow, otherPagesTotals]);

  const cols = editableColumns(orderType);
  const selectableIds = rows.filter((r) => !finalizedByRow[r.id]).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSave = async () => {
    setBulkWorking("save");
    setBulkMessage(null);
    const ids = [...selected].filter((id) => !finalizedByRow[id]);
    const results = await Promise.all(ids.map((id) => rowRefs.current.get(id)?.save() ?? Promise.resolve(false)));
    const succeeded = results.filter(Boolean).length;
    setBulkMessage(ids.length === 0 ? "No selected rows to save." : `Saved ${succeeded} of ${ids.length} selected row${ids.length === 1 ? "" : "s"}.`);
    setBulkWorking(null);
  };

  const bulkFinalize = async () => {
    setBulkWorking("finalize");
    setBulkMessage(null);
    const ids = [...selected].filter((id) => !finalizedByRow[id]);
    const results = await Promise.all(ids.map((id) => rowRefs.current.get(id)?.finalizeIfNeeded() ?? Promise.resolve(false)));
    const succeeded = results.filter(Boolean).length;
    setBulkMessage(ids.length === 0 ? "No selected rows to finalize." : `Finalized ${succeeded} of ${ids.length} selected row${ids.length === 1 ? "" : "s"}.`);
    setSelected(new Set());
    setBulkWorking(null);
  };

  // Delegated on the <table> so every cost/profit input (identified by its
  // data-cell="row:col" attribute) gets arrow-key navigation for free — no
  // per-input keydown wiring needed as rows are added or removed.
  const handleKeyDown = (ev: React.KeyboardEvent<HTMLTableElement>) => {
    const key = ev.key;
    if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return;
    const target = ev.target as HTMLElement;
    const cell = target.dataset.cell;
    if (!cell) return;

    const [rowStr, col] = cell.split(":");
    const row = Number(rowStr);
    const colIndex = cols.indexOf(col);
    if (colIndex === -1) return;

    let nextRow = row;
    let nextCol = colIndex;
    if (key === "ArrowUp") nextRow -= 1;
    else if (key === "ArrowDown") nextRow += 1;
    else if (key === "ArrowLeft") nextCol -= 1;
    else nextCol += 1;

    if (nextRow < 0 || nextRow >= rows.length || nextCol < 0 || nextCol >= cols.length) return;

    ev.preventDefault();
    const next = ev.currentTarget.querySelector<HTMLInputElement>(`[data-cell="${nextRow}:${cols[nextCol]}"]`);
    next?.focus();
    next?.select();
  };

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 dark:border-stone-700 bg-stone-25 dark:bg-white/[0.02] flex-wrap">
        <span className="text-xs text-stone-500">
          {selected.size > 0 ? `${selected.size} selected` : "Select rows to bulk save or finalize"}
        </span>
        <button
          type="button" onClick={bulkSave} disabled={selected.size === 0 || bulkWorking !== null}
          className="btn-outline text-xs py-1 px-2.5 disabled:opacity-40"
        >
          {bulkWorking === "save" ? <Loader2 size={13} className="animate-spin" /> : null}
          Bulk Save
        </button>
        {isAdmin && (
          <button
            type="button" onClick={bulkFinalize} disabled={selected.size === 0 || bulkWorking !== null}
            className="btn-outline text-xs py-1 px-2.5 disabled:opacity-40"
          >
            {bulkWorking === "finalize" ? <Loader2 size={13} className="animate-spin" /> : null}
            Bulk Finalize
          </button>
        )}
        {bulkMessage && <span className="text-xs text-stone-500">{bulkMessage}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" onKeyDown={handleKeyDown}>
          <thead>
            <tr>
              <th className="th w-10">
                <input
                  type="checkbox" checked={allSelected} disabled={selectableIds.length === 0}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                  className="accent-amber-600"
                />
              </th>
              <th className="th text-left">Date</th>
              <th className="th text-left">Receipt</th>
              <th className="th text-right">Bill Amount</th>
              <th className="th text-right">Total Quantity</th>
              <th className="th text-right">Fabric Cost</th>
              <th className="th text-right">Pattern Making Cost</th>
              {orderType === "BULK" && <th className="th text-right">Cutting Cost</th>}
              <th className="th text-right">Production Cost</th>
              {orderType === "BULK" && <th className="th text-right">Accessories Cost</th>}
              {orderType === "BULK" && <th className="th text-right">Other</th>}
              <th className="th text-right sticky right-20 z-20 w-28 border-l border-stone-200 dark:border-stone-700">Profit</th>
              <th className="th text-center sticky right-0 z-20 w-20">Finalize</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={colSpan} className="td text-center text-stone-400 py-10">No orders found.</td></tr>
            )}
            {rows.map((r, index) => (
              <ExpenseRow
                key={r.id}
                ref={(handle) => {
                  if (handle) rowRefs.current.set(r.id, handle);
                  else rowRefs.current.delete(r.id);
                }}
                rowIndex={index}
                receiptId={r.id}
                receiptNumber={r.receiptNumber}
                custName={r.custName}
                date={r.date}
                billAmount={r.billAmount}
                totalQuantity={r.totalQuantity}
                orderType={orderType}
                initial={r.initial}
                isAdmin={isAdmin}
                selected={selected.has(r.id)}
                onToggleSelected={() => toggleRow(r.id)}
                onSaved={(values) => setSavedByRow((prev) => ({ ...prev, [r.id]: values }))}
                onFinalizedChange={(finalized) => {
                  setFinalizedByRow((prev) => ({ ...prev, [r.id]: finalized }));
                  if (finalized) setSelected((prev) => { const next = new Set(prev); next.delete(r.id); return next; });
                }}
              />
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-stone-25 dark:bg-white/[0.02] font-semibold">
                <td />
                <td colSpan={2} className="td text-right text-ink">Total</td>
                <td className="td text-right font-mono">{fmtMoney(totals.bill)}</td>
                <td className="td text-right font-mono">{totals.quantity.toLocaleString()}</td>
                <td className="td text-right">{totalCell(totals.fabric)}</td>
                <td className="td text-right">{totalCell(totals.patternMaking)}</td>
                {orderType === "BULK" && <td className="td text-right">{totalCell(totals.cutting)}</td>}
                <td className="td text-right">{totalCell(totals.production)}</td>
                {orderType === "BULK" && <td className="td text-right">{totalCell(totals.accessory)}</td>}
                {orderType === "BULK" && <td className="td text-right">{totalCell(totals.other)}</td>}
                <td className="td text-right sticky right-20 z-10 w-28 border-l border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">{totalCell(totals.profit)}</td>
                <td className="td sticky right-0 z-10 w-20 bg-stone-50 dark:bg-stone-800" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
