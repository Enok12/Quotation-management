"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Check } from "lucide-react";
import { ORDER_STAGES, ORDER_STAGE_LABELS, type OrderStage } from "@/lib/order-stage";
import { cn } from "@/lib/utils/cn";

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
  const [justSaved, setJustSaved] = useState(false);

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
      router.refresh();
      setSaving(false);
      setJustSaved(true);
      // Hold a brief, visible "saved" confirmation before handing control
      // back to the caller (e.g. an expandable row collapsing back to a
      // badge) — swapping views the instant the request resolves reads as
      // if nothing happened.
      window.setTimeout(() => {
        setJustSaved(false);
        onChanged?.(to);
      }, 700);
    } catch (e) {
      setValue(prev);
      setSaving(false);
      alert(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  return (
    <div className="relative inline-block">
      <select
        value={value}
        disabled={saving || justSaved}
        onChange={(e) => change(e.target.value as OrderStage)}
        className={cn(
          "appearance-none bg-white dark:bg-stone-800 border rounded px-2 py-1.5 pr-7 text-xs text-ink outline-none transition-colors duration-300 cursor-pointer disabled:cursor-default",
          justSaved
            ? "border-emerald-400 ring-1 ring-emerald-400"
            : "border-stone-200 dark:border-stone-700 hover:border-amber-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-60",
        )}
      >
        {ORDER_STAGES.map((s) => (
          <option key={s} value={s}>{ORDER_STAGE_LABELS[s]}</option>
        ))}
      </select>
      {saving && <Loader2 size={12} className="animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />}
      {justSaved && <Check size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />}
      {!saving && !justSaved && (
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
      )}
    </div>
  );
}
