"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Tab {
  label: string;
  href: string;
  active: boolean;
}

/**
 * Renders the receipt status / order-status filter tabs and wraps the table.
 * Tab clicks navigate inside a transition, so while the server re-queries we
 * keep the current table visible and overlay a loading state on it.
 */
export function ReceiptsFilterShell({
  statusTabs,
  orderTabs,
  children,
}: {
  statusTabs?: Tab[];
  orderTabs: Tab[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const go = (href: string) => startTransition(() => router.push(href));

  const tabClass = (active: boolean) =>
    cn(
      "px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:cursor-not-allowed",
      active ? "bg-ink text-white" : "text-stone-500 hover:bg-stone-100",
    );

  return (
    <>
      <div className="flex items-center gap-6 mb-4 flex-wrap">
        {statusTabs && statusTabs.length > 0 && (
          <>
            <div className="flex gap-1">
              {statusTabs.map((t) => (
                <button key={t.label} onClick={() => go(t.href)} disabled={isPending} className={tabClass(t.active)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-stone-200" />
          </>
        )}
        <div className="flex gap-1 flex-wrap">
          {orderTabs.map((t) => (
            <button key={t.label} onClick={() => go(t.href)} disabled={isPending} className={tabClass(t.active)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className={cn("transition-opacity", isPending && "opacity-50 pointer-events-none")}>
          {children}
        </div>
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-24">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-stone-600 shadow-md border border-stone-100">
              <Loader2 size={16} className="animate-spin text-amber-500" />
              Loading…
            </span>
          </div>
        )}
      </div>
    </>
  );
}
