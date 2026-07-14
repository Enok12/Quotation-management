"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ORDER_STAGES, ORDER_STAGE_LABELS, type OrderStage } from "@/lib/order-stage";
import { OrderStatusSelect } from "./order-status-select";

interface Item { id: string; description: string; orderStatus: string }

// Per-item production status, plus a "set all at once" shortcut for the
// common case where every item on an order genuinely moves together. That
// shortcut is a deliberate two-step (pick a stage, then Apply) rather than
// an auto-applying select, since it affects every item at once.
export function ItemStatusPanel({ receiptId, items }: { receiptId: string; items: Item[] }) {
  const router = useRouter();
  const [bulkValue, setBulkValue] = useState<OrderStage>("FABRIC_SELECTION");
  const [applying, setApplying] = useState(false);

  const applyToAll = async () => {
    setApplying(true);
    try {
      const res = await fetch(`/api/v1/orders/${receiptId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: bulkValue }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to update status");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-3">
      {items.length > 1 && (
        <div className="flex items-center gap-2 pb-3 border-b border-stone-100 dark:border-stone-700">
          <select
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value as OrderStage)}
            disabled={applying}
            className="field-input text-xs py-1.5 flex-1"
          >
            {ORDER_STAGES.map((s) => (
              <option key={s} value={s}>{ORDER_STAGE_LABELS[s]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyToAll}
            disabled={applying}
            className="btn-outline text-xs py-1.5 whitespace-nowrap"
          >
            {applying && <Loader2 size={12} className="animate-spin" />}
            Apply to all {items.length}
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-ink truncate">{item.description}</span>
            <OrderStatusSelect statusUrl={`/api/v1/receipt-items/${item.id}/status`} status={item.orderStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
}
