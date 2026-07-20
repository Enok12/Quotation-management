"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, X } from "lucide-react";
import { OrderStatusBadge } from "./status-badges";

interface Item {
  id: string;
  description: string;
  quantity: number;
  orderStatus: string;
}

// Read-only view of every item's actual production status for one receipt —
// the list page only shows the receipt's bottleneck stage (see
// OrderProgressBadge), which hides that individual items can be at different
// stages. Editing stays on the receipt detail page (ItemStatusPanel); this is
// purely for a quick glance without leaving the list.
export function ItemStatusPopup({
  receiptId,
  receiptNumber,
  custName,
  items,
}: {
  receiptId: string;
  receiptNumber: number | null;
  custName: string;
  items: Item[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="View item status"
        aria-label="View item status"
        className="inline-flex items-center gap-1 text-stone-400 hover:text-amber-600 dark:text-stone-500 dark:hover:text-amber-400 transition-colors text-xs"
      >
        <Layers size={13} />
        {items.length}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl text-ink">
                  {receiptNumber !== null ? `#${receiptNumber}` : "Unconfirmed"}
                </h3>
                <p className="text-stone-500 text-sm">{custName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <ul className="space-y-2.5 max-h-96 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink truncate">
                    {item.description} <span className="text-stone-400">× {item.quantity}</span>
                  </span>
                  <OrderStatusBadge status={item.orderStatus} />
                </li>
              ))}
            </ul>

            <Link
              href={`/dashboard/receipts/${receiptId}`}
              className="btn-outline text-xs py-1.5 w-full justify-center mt-4"
            >
              Open Receipt
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
