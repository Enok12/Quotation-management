"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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

export function OrderStatusChanger({ receiptId, currentStatus }: { receiptId: string; currentStatus: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const change = async (to: OS) => {
    if (to === currentStatus) return;
    setLoading(true);
    const res = await fetch(`/api/v1/orders/${receiptId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    const json = await res.json();
    if (json.success) { router.refresh(); } else { alert(json.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-1.5">
      {ORDER_STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => change(s)}
          disabled={loading}
          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
            s === currentStatus
              ? "bg-amber-100 text-amber-800 font-semibold cursor-default"
              : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
