"use client";

import { useState } from "react";
import { History, X, Loader2 } from "lucide-react";
import { fmtDateTime } from "@/lib/utils/format";

interface Movement {
  id: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  reason: string;
  note: string | null;
  performedBy: string;
  createdAt: string;
}

const TYPE_LABEL: Record<Movement["type"], string> = { IN: "+ In", OUT: "− Out", ADJUSTMENT: "Adjustment" };
const TYPE_CLASS: Record<Movement["type"], string> = {
  IN: "text-emerald-600 dark:text-emerald-400",
  OUT: "text-red-600 dark:text-red-400",
  ADJUSTMENT: "text-amber-600 dark:text-amber-400",
};

export function StockHistoryButton({ productId, sku }: { productId: string; sku: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openAndLoad = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/inventory/products/${productId}/movements`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Failed to load history");
      setMovements(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={openAndLoad}
        title="Stock History"
        aria-label="Stock History"
        className="text-stone-400 hover:text-amber-600 dark:text-stone-500 dark:hover:text-amber-400 transition-colors p-1"
      >
        <History size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-lg p-6 modal-panel-in max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-xl text-ink">Stock History · <code className="font-mono text-base">{sku}</code></h3>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            {loading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-amber-500" /></div>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {!loading && !error && movements?.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-8">No stock movements yet.</p>
            )}
            {!loading && movements && movements.length > 0 && (
              <div className="space-y-2">
                {movements.map((m) => (
                  <div key={m.id} className="border border-stone-200 dark:border-stone-700 rounded px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className={TYPE_CLASS[m.type]}>{TYPE_LABEL[m.type]} {m.quantity}</span>
                      <span className="text-xs text-stone-400">{fmtDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-stone-600 dark:text-stone-300 mt-0.5">{m.reason}</p>
                    {m.note && <p className="text-xs text-stone-400 mt-0.5">{m.note}</p>}
                    <p className="text-xs text-stone-400 mt-0.5">by {m.performedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
