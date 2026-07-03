"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";

const ORDER_STATUSES = [
  "FABRIC_SELECTION", "CUTTING", "PRODUCTION", "QUALITY_CHECK", "IRON_PACKING", "DELIVERY",
] as const;
type OS = (typeof ORDER_STATUSES)[number];

const LABELS: Record<OS, string> = {
  FABRIC_SELECTION: "Fabric Selection",
  CUTTING: "Cutting",
  PRODUCTION: "Production",
  QUALITY_CHECK: "Quality Check",
  IRON_PACKING: "Iron / Packing",
  DELIVERY: "Delivery",
};

// Inline dropdown for updating a receipt's order status directly from a table
// row — no navigation, updates in place.
export function OrderStatusSelect({ receiptId, status }: { receiptId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState<OS>(status as OS);
  const [saving, setSaving] = useState(false);

  const change = async (to: OS) => {
    if (to === value) return;
    const prev = value;
    setValue(to); // optimistic
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/orders/${receiptId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to update status");
      router.refresh();
    } catch (e) {
      setValue(prev);
      alert(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block">
      <select
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value as OS)}
        className="appearance-none bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 pr-7 text-xs text-ink hover:border-amber-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors disabled:opacity-60 cursor-pointer"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>{LABELS[s]}</option>
        ))}
      </select>
      {saving ? (
        <Loader2 size={12} className="animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
      ) : (
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
      )}
    </div>
  );
}
