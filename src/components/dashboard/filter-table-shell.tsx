"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface ShellTab {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

/**
 * Renders one or more groups of filter tabs and wraps a table. Switching tabs
 * navigates inside a transition, so the current table stays visible with a
 * loading overlay until the new data arrives. Groups are separated by a divider.
 */
export function FilterTableShell({
  groups,
  children,
}: {
  groups: ShellTab[][];
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
        {groups.map((tabs, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <div className="w-px h-4 bg-stone-200" />}
            <div className="flex gap-1 flex-wrap">
              {tabs.map((t) => (
                <button key={t.label} onClick={() => go(t.href)} disabled={isPending} className={tabClass(t.active)}>
                  {t.label}
                  {t.count !== undefined && (
                    <span className={cn("ml-1.5", t.active ? "text-white/70" : "text-stone-400")}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>
          </Fragment>
        ))}
      </div>

      <div className="relative">
        <div className={cn("transition-opacity", isPending && "opacity-50 pointer-events-none")}>{children}</div>
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
