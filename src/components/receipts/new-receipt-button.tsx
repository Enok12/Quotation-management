"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, X, AlertTriangle } from "lucide-react";

interface IncompleteSample {
  id: string;
  label: string; // e.g. "S-01"
  reason: string; // e.g. "Payment pending · In production"
}

// "New Receipt" for a specific customer. Before navigating to the builder it
// checks whether the customer has an OPEN sample order — one not yet converted
// to a bulk order — and, if so, asks whether the user actually meant to
// continue or convert that sample instead of starting a fresh receipt, so a
// pending sample doesn't quietly get duplicated or forgotten.
export function NewReceiptButton({
  customerId,
  className,
  children,
  icon,
}: {
  customerId: string;
  className?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [samples, setSamples] = useState<IncompleteSample[] | null>(null);

  const newReceiptHref = `/dashboard/receipts/new?customerId=${customerId}`;

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/incomplete-samples`);
      const json = await res.json();
      // If the check fails for any reason, don't block the user — just proceed.
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setSamples(json.data);
        return;
      }
      router.push(newReceiptHref);
    } catch {
      router.push(newReceiptHref);
    } finally {
      setLoading(false);
    }
  };

  const proceed = () => {
    setSamples(null);
    router.push(newReceiptHref);
  };

  return (
    <>
      <button type="button" onClick={onClick} disabled={loading} className={className}>
        {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
        {children}
      </button>

      {samples && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 modal-overlay-in" onClick={() => setSamples(null)}>
          <div className="bg-white dark:bg-stone-800 rounded-lg shadow-xl w-full max-w-md p-6 modal-panel-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500 flex-none" />
                <h3 className="font-serif text-xl text-ink">Open sample order</h3>
              </div>
              <button onClick={() => setSamples(null)} className="text-stone-400 hover:text-ink"><X size={18} /></button>
            </div>

            <p className="text-sm text-stone-600 dark:text-stone-300 mb-3">
              This customer has {samples.length === 1 ? "a sample order that hasn't been converted to bulk yet" : `${samples.length} sample orders not yet converted to bulk`}.
              Did you mean to continue or convert {samples.length === 1 ? "it" : "one of them"} instead?
            </p>

            <ul className="space-y-2 mb-5">
              {samples.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/receipts/${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2 hover:border-amber-400 transition-colors"
                  >
                    <span className="text-sm">
                      <span className="font-mono font-semibold text-ink">{s.label}</span>
                      {s.reason && <span className="text-stone-400"> · {s.reason}</span>}
                    </span>
                    <span className="text-xs text-amber-600 whitespace-nowrap">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setSamples(null)} className="btn-ghost text-xs py-1.5">Cancel</button>
              <button type="button" onClick={proceed} className="btn-primary text-xs py-1.5">No, create a new receipt</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
