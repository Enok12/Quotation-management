"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface ExpenseRecordValues {
  fabricExpense: number;
  sewingExpense: number;
  accessoryExpense: number;
  otherExpense: number;
  profit: number;
  finalized: boolean;
}

const defaults = (billAmount: number): ExpenseRecordValues => ({
  fabricExpense: 0,
  sewingExpense: 0,
  accessoryExpense: 0,
  otherExpense: 0,
  profit: billAmount,
  finalized: false,
});

/**
 * Shared editing state for a receipt's expense record: the four cost fields,
 * a Profit field that auto-recalculates from them until the user types over
 * it directly (same pattern as Advance Payment in the receipt builder), and
 * finalize/unlock actions. Used by both the receipt-detail card and the
 * global Expenses table row.
 */
export function useExpenseEditor(receiptId: string, billAmount: number, initial: ExpenseRecordValues | null) {
  const router = useRouter();
  const base = initial ?? defaults(billAmount);

  const [fabricExpense, setFabricExpense] = useState(String(base.fabricExpense));
  const [sewingExpense, setSewingExpense] = useState(String(base.sewingExpense));
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
      (Number(fabricExpense) || 0) + (Number(sewingExpense) || 0) + (Number(accessoryExpense) || 0) + (Number(otherExpense) || 0);
    setProfit(String(Math.round((billAmount - total) * 100) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricExpense, sewingExpense, accessoryExpense, otherExpense, billAmount, profitTouched, finalized]);

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
          sewingExpense: Number(sewingExpense) || 0,
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
    sewingExpense, setSewingExpense,
    accessoryExpense, setAccessoryExpense,
    otherExpense, setOtherExpense,
    profit, onProfitChange,
    finalized, saving, finalizing, error,
    save, toggleFinalize,
  };
}
