"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Loader2, Pencil, X } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { OrderStatusBadge } from "@/components/receipts/status-badges";
import { OrderStatusSelect } from "@/components/receipts/order-status-select";
import type { OrderStage } from "@/lib/order-stage";
import { receiptNumberLabel, type ReceiptOrderType } from "@/lib/utils/receipt-number";
import { AssignPatternButton } from "@/components/styles/assign-pattern-button";

interface Item {
  id: string;
  description: string;
  orderStatus: string;
  /** Code of the assigned pattern, or null if none has been assigned yet. */
  patternCode: string | null;
}

interface Props {
  receiptId: string;
  receiptNumber: number;
  orderType: ReceiptOrderType;
  custName: string;
  date: string | Date;
  totalDue: number;
  balance: number;
  /** Assigning a style is an admin decision, so the control is hidden (and
   * server-side refused) for everyone else. */
  isAdmin: boolean;
}

// One row in the Production list. Collapsed by default — items are only
// fetched the first time a row is expanded, not up front for every row on
// the page, so the list stays cheap regardless of how many orders are shown.
export function ExpandableOrderRow({ receiptId, receiptNumber, orderType, custName, date, totalDue, balance, isAdmin }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only one item's status editor open at a time within this row.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && items === null) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/receipts/${receiptId}/items`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message ?? "Failed to load items");
        setItems(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load items");
      } finally {
        setLoading(false);
      }
    }
  };

  // Keeps the cached item list in sync with a change made through the
  // dropdown below, so collapsing and re-expanding this row (which remounts
  // the dropdown from `items`) shows the current value, not the one from
  // whenever this row was first expanded.
  const updateCachedStatus = (itemId: string, next: OrderStage) => {
    setItems((prev) => prev?.map((it) => (it.id === itemId ? { ...it, orderStatus: next } : it)) ?? prev);
  };

  return (
    <>
      <tr className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
        <td className="td">
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "Collapse items" : "Expand items"}
            className="text-stone-400 hover:text-amber-600 transition-colors p-0.5"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="td font-mono text-xs text-stone-500">{receiptNumberLabel(receiptNumber, orderType)}</td>
        <td className="td font-medium">
          <Link href={`/dashboard/receipts/${receiptId}`} className="hover:text-amber-600 transition-colors">
            {custName}
          </Link>
        </td>
        <td className="td text-stone-500">{fmtDate(date)}</td>
        <td className="td text-right font-mono">{fmtMoney(totalDue)}</td>
        <td className="td text-right font-mono">{fmtMoney(balance)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="td bg-stone-25 dark:bg-white/[0.02] py-3">
            {loading && (
              <div className="flex items-center gap-2 text-xs text-stone-400 py-2">
                <Loader2 size={13} className="animate-spin" /> Loading items…
              </div>
            )}
            {error && <p className="text-xs text-red-500 py-2">{error}</p>}
            {items && items.length === 0 && <p className="text-xs text-stone-400 py-2">No items on this receipt.</p>}
            {items && items.length > 0 && (
              // Wider than the original max-w-lg: each row now carries a
              // description, a pattern control and a status control.
              <ul className="space-y-2 max-w-3xl">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    {/* The description truncates, so every control must be a
                        SIBLING of it rather than a child — nested inside, they
                        get clipped by the same overflow rule whenever the
                        description is long enough to ellipsize. */}
                    <span className="text-sm text-ink truncate flex-1 min-w-0">{item.description}</span>
                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-1.5 flex-none">
                        <OrderStatusSelect
                          statusUrl={`/api/v1/receipt-items/${item.id}/status`}
                          status={item.orderStatus}
                          onChanged={(next) => {
                            updateCachedStatus(item.id, next);
                            setEditingItemId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          title="Cancel"
                          aria-label="Cancel"
                          className="text-stone-400 hover:text-ink transition-colors p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-none">
                        <OrderStatusBadge status={item.orderStatus} />
                        <button
                          type="button"
                          onClick={() => setEditingItemId(item.id)}
                          className="btn-ghost text-xs py-1"
                        >
                          <Pencil size={12} /> Change Status
                        </button>
                        {isAdmin && (
                          <AssignPatternButton
                            itemId={item.id}
                            itemDescription={item.description}
                            assignedCode={item.patternCode}
                          />
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
