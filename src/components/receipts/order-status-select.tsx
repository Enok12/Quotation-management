"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { ORDER_STAGES, ORDER_STAGE_LABELS, type OrderStage } from "@/lib/order-stage";

// Inline dropdown for updating a status directly from a table/list row — no
// navigation, updates in place. `statusUrl` is whatever endpoint accepts
// `{ status }` — the receipt-item route for a single item's status.
export function OrderStatusSelect({
  statusUrl,
  status,
  onChanged,
}: {
  statusUrl: string;
  status: string;
  /** Called after a successful save — lets a caller that caches this item's
   * status elsewhere (e.g. an expandable row's fetched item list) update its
   * own copy, so it doesn't show a stale value if this component unmounts
   * and remounts later (e.g. the row is collapsed and re-expanded) before a
   * full page refresh happens. */
  onChanged?: (next: OrderStage) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState<OrderStage>(status as OrderStage);
  const [saving, setSaving] = useState(false);

  const change = async (to: OrderStage) => {
    if (to === value) return;
    const prev = value;
    setValue(to); // optimistic
    setSaving(true);
    try {
      const res = await fetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to update status");
      onChanged?.(to);
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
        onChange={(e) => change(e.target.value as OrderStage)}
        className="appearance-none bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded px-2 py-1.5 pr-7 text-xs text-ink hover:border-amber-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none transition-colors disabled:opacity-60 cursor-pointer"
      >
        {ORDER_STAGES.map((s) => (
          <option key={s} value={s}>{ORDER_STAGE_LABELS[s]}</option>
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
