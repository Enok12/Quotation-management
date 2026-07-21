"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/utils/format";
import { OrderProgressBadge } from "@/components/receipts/status-badges";

interface ReminderOrder {
  id: string;
  receiptNumber: number | null;
  custName: string;
  date: string;
  balance: number;
  orderStatus: string;
}

const SEEN_KEY = "montra:reminders-seen";

// Local calendar date, deliberately NOT toISOString().slice(0, 10) — that
// yields the UTC date, which in Sri Lanka (UTC+5:30) rolls over at 5:30am
// local time. That's inside the very morning window this popup targets, so a
// UTC key would mark a new day mid-morning and re-show reminders someone had
// already seen. This tracks the user's own calendar day instead.
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Once-a-day popup listing ongoing orders (confirmed, not yet Completed), so
 * the first visit of each morning surfaces what's still outstanding.
 *
 * Shown at most once per calendar day per browser: the "seen" flag is written
 * as soon as the check completes — whether or not there was anything to show
 * — so it never re-appears while navigating around the dashboard, and the API
 * is hit only once a day rather than on every page load.
 */
export function DailyReminders() {
  const [orders, setOrders] = useState<ReminderOrder[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // localStorage is read inside the effect (never during render) so the
    // server and first client render always agree — otherwise this would
    // hydration-mismatch.
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      // Private mode / storage disabled — skip silently rather than nagging
      // on every single page load.
      return;
    }
    if (seen === todayKey()) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/reminders");
        const json = await res.json();
        if (cancelled || !json.success) return;
        // Mark the day as done even when there's nothing to show, so a quiet
        // day costs exactly one request rather than one per navigation.
        try {
          localStorage.setItem(SEEN_KEY, todayKey());
        } catch {
          /* ignore */
        }
        if (json.data.orders.length === 0) return;
        setOrders(json.data.orders);
        setTotal(json.data.total);
        setOpen(true);
      } catch {
        // A reminder is ambient — a failed fetch should never surface an
        // error to someone who didn't ask for anything.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open || !orders) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setOpen(false)}>
      <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-lg p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-amber-500" />
            <h3 className="font-serif text-xl text-ink">Ongoing Orders</h3>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-stone-400 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-4">
          {total} order{total === 1 ? "" : "s"} still in production — oldest first.
        </p>

        <ul className="divide-y divide-stone-100 dark:divide-stone-700 max-h-80 overflow-y-auto">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/dashboard/receipts/${o.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 py-2.5 hover:bg-stone-25 dark:hover:bg-white/5 transition-colors -mx-2 px-2 rounded"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">
                    <span className="font-mono text-stone-500 text-xs">#{o.receiptNumber}</span> {o.custName}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {fmtDate(o.date)}
                    {o.balance > 0 && <> · Balance {fmtMoney(o.balance)}</>}
                  </p>
                </div>
                {/* Deliberately the coarse Ongoing/Completed badge, not the
                    per-stage one — the granular stage is detail for the
                    Production page, not for a morning glance. Every row here
                    is ongoing by construction (the query excludes COMPLETED). */}
                <OrderProgressBadge status={o.orderStatus} />
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 mt-5">
          <Link
            href="/dashboard/orders"
            onClick={() => setOpen(false)}
            className="btn-outline text-xs py-1.5 flex-1 justify-center"
          >
            View all {total > orders.length ? `(${total})` : ""}
          </Link>
          <button onClick={() => setOpen(false)} className="btn-primary text-xs py-1.5 flex-1 justify-center">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
