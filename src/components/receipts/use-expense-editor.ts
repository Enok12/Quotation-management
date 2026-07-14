"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const defaults = (billAmount: number): ExpenseRecordValues => ({
  fabricExpense: 0,
  patternMakingExpense: 0,
  cuttingExpense: 0,
  productionExpense: 0,
  accessoryExpense: 0,
  otherExpense: 0,
  profit: billAmount,
  finalized: false,
});

/**
 * Shared editing state for a receipt's expense record: the six cost fields
 * (a Bulk order uses all six; a Sample order only fabric/patternMaking/
 * production — the caller decides which to render), a Profit field that
 * auto-recalculates from all six until the user types over it directly (same
 * pattern as Advance Payment in the receipt builder), and finalize/unlock
 * actions. Used by both the receipt-detail card and the global Expenses table row.
 */
export function useExpenseEditor(receiptId: string, billAmount: number, initial: ExpenseRecordValues | null) {
  const router = useRouter();
  const base = initial ?? defaults(billAmount);

  const [fabricExpense, setFabricExpense] = useState(String(base.fabricExpense));
  const [patternMakingExpense, setPatternMakingExpense] = useState(String(base.patternMakingExpense));
  const [cuttingExpense, setCuttingExpense] = useState(String(base.cuttingExpense));
  const [productionExpense, setProductionExpense] = useState(String(base.productionExpense));
  const [accessoryExpense, setAccessoryExpense] = useState(String(base.accessoryExpense));
  const [otherExpense, setOtherExpense] = useState(String(base.otherExpense));
  const [profit, setProfit] = useState(String(base.profit));
  const [profitTouched, setProfitTouched] = useState(false);
  const [finalized, setFinalized] = useState(base.finalized);
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
      const res = await fetch(`/api/v1/receipts/${receiptId}/expenses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricExpense: Number(fabricExpense) || 0,
          patternMakingExpense: Number(patternMakingExpense) || 0,
          cuttingExpense: Number(cuttingExpense) || 0,
          productionExpense: Number(productionExpense) || 0,
          accessoryExpense: Number(accessoryExpense) || 0,
          otherExpense: Number(otherExpense) || 0,
          profit: Number(profit) || 0,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to save");
      router.refresh();
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
      router.refresh();
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
