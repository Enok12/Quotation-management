"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { OrderStatusBadge } from "@/components/receipts/status-badges";
import { StageTimeline } from "./stage-timeline";

interface Item {
  id: string;
  description: string;
  orderStatus: string;
  stageDates: Partial<Record<string, Date | string>>;
}

// Compact tile grid, one tile per item — tapping a tile reveals that item's
// full stage timeline in place of the grid, with a way back.
export function ItemTrackingGrid({ items }: { items: Item[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  if (selected) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-600 transition-colors mb-4"
        >
          <ArrowLeft size={13} /> Back to items
        </button>
        <div className="card card-body">
          <h2 className="text-sm font-semibold text-ink mb-4">{selected.description}</h2>
          <StageTimeline currentStatus={selected.orderStatus} stageDates={selected.stageDates} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelectedId(item.id)}
          className="card card-body flex flex-col items-start gap-2 text-left hover:border-amber-300 dark:hover:border-amber-500/40 transition-colors"
        >
          <span className="text-sm font-medium text-ink">{item.description}</span>
          <OrderStatusBadge status={item.orderStatus} />
        </button>
      ))}
    </div>
  );
}
