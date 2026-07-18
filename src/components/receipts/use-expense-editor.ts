"use client";

import { useEffect, useState } from "react";

export interface ExpenseRecordValues {
  fabricExpense: number;
  patternMakingExpense: number;
  cuttingExpense: number;
  productionExpense: number;
  accessoryExpense: number;
  otherExpense: number;
  profit: number;
  finalized: boolean;
}

export interface ExpenseCostTotals {
  fabricExpense: number;
  patternMakingExpense: number;
  cuttingExpense: number;
  productionExpense: number;
  accessoryExpense: number;
  otherExpense: number;
  profit: number;
}

/**
 * Shared editing state for a receipt's expense record: the six cost fields
 * (a Bulk order uses all six; a Sample order only fabric/patternMaking/
 * production — the caller decides which to render), a Profit field that
 * auto-recalculates from all six until the user types over it directly (same
 * pattern as Advance Payment in the receipt builder), and finalize/unlock
 * actions. Used by both the receipt-detail card and the global Expenses table row.
 *
 * Cost fields start blank (not "0") when there's no saved record yet, so
 * typing a value doesn't require deleting a placeholder zero first. `onSaved`
 * lets a parent (e.g. the Expenses table, which totals many rows at once)
 * keep its own running totals in sync without a full page refresh — a
 * refresh would re-render every sibling row from the server and blow away
 * whatever anyone else had typed but not yet saved.
 */
export function useExpenseEditor(
  receiptId: string,
  billAmount: number,
  initial: ExpenseRecordValues | null,
  onSaved?: (values: ExpenseCostTotals) => void,
  onFinalizedChange?: (finalized: boolean) => void,
) {
  const [fabricExpense, setFabricExpense] = useState(initial ? String(initial.fabricExpense) : "");
  const [patternMakingExpense, setPatternMakingExpense] = useState(initial ? String(initial.patternMakingExpense) : "");
  const [cuttingExpense, setCuttingExpense] = useState(initial ? String(initial.cuttingExpense) : "");
  const [productionExpense, setProductionExpense] = useState(initial ? String(initial.productionExpense) : "");
  const [accessoryExpense, setAccessoryExpense] = useState(initial ? String(initial.accessoryExpense) : "");
  const [otherExpense, setOtherExpense] = useState(initial ? String(initial.otherExpense) : "");
  const [profit, setProfit] = useState(String(initial ? initial.profit : billAmount));
  const [profitTouched, setProfitTouched] = useState(false);
  const [finalized, setFinalized] = useState(initial?.finalized ?? false);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profitTouched || finalized) return;
    const total =
      (Number(fabricExpense) || 0) + (Number(patternMakingExpense) || 0) + (Number(cuttingExpense) || 0) +
      (Number(productionExpense) || 0) + (Number(accessoryExpense) || 0) + (Number(otherExpense) || 0);
    setProfit(String(Math.round((billAmount - total) * 100) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricExpense, patternMakingExpense, cuttingExpense, productionExpense, accessoryExpense, otherExpense, billAmount, profitTouched, finalized]);

  const onProfitChange = (v: string) => {
    setProfitTouched(true);
    setProfit(v);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const values: ExpenseCostTotals = {
        fabricExpense: Number(fabricExpense) || 0,
        patternMakingExpense: Number(patternMakingExpense) || 0,
        cuttingExpense: Number(cuttingExpense) || 0,
        productionExpense: Number(productionExpense) || 0,
        accessoryExpense: Number(accessoryExpense) || 0,
        otherExpense: Number(otherExpense) || 0,
        profit: Number(profit) || 0,
      };
      const res = await fetch(`/api/v1/receipts/${receiptId}/expenses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save");
      onSaved?.(values);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleFinalize = async () => {
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/receipts/${receiptId}/expenses/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalized: !finalized }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to update");
      setFinalized(json.data.finalized);
      onFinalizedChange?.(json.data.finalized);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setFinalizing(false);
    }
  };

  return {
    fabricExpense, setFabricExpense,
    patternMakingExpense, setPatternMakingExpense,
    cuttingExpense, setCuttingExpense,
    productionExpense, setProductionExpense,
    accessoryExpense, setAccessoryExpense,
    otherExpense, setOtherExpense,
    profit, onProfitChange,
    finalized, saving, finalizing, error,
    save, toggleFinalize,
  };
}
