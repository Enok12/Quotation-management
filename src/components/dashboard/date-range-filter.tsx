"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { CalendarRange, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// Reads/writes ?from=&to= on the current URL. Preserves every other existing
// query param and resets ?page so a new date range starts at page 1.
//
// defaultFrom/defaultTo let a page show an implied range (e.g. "this month")
// without redirecting to write it into the URL first — a server-side
// redirect for that would cost an extra round trip and cause a visible
// flash between the loading skeleton and the real content.
export function DateRangeFilter({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom?: string;
  defaultTo?: string;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const from = searchParams.get("from") ?? defaultFrom ?? "";
  const to = searchParams.get("to") ?? defaultTo ?? "";

  const setParam = useCallback(
    (key: "from" | "to", value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      // Commit the other field's implied default too, so the resulting range
      // matches what was actually showing on screen.
      if (!params.has("from") && defaultFrom && key !== "from") params.set("from", defaultFrom);
      if (!params.has("to") && defaultTo && key !== "to") params.set("to", defaultTo);

      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    },
    [router, pathname, searchParams, defaultFrom, defaultTo],
  );

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    params.delete("page");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }, [router, pathname, searchParams]);

  return (
    <div className={cn("flex items-center gap-1.5", isPending && "opacity-60")}>
      <CalendarRange size={14} className="text-stone-400 flex-none" />
      <input
        type="date"
        value={from}
        max={to || undefined}
        onChange={(e) => setParam("from", e.target.value)}
        aria-label="From date"
        className="field-input py-1.5 text-xs w-auto"
      />
      <span className="text-stone-400 text-xs">to</span>
      <input
        type="date"
        value={to}
        min={from || undefined}
        onChange={(e) => setParam("to", e.target.value)}
        aria-label="To date"
        className="field-input py-1.5 text-xs w-auto"
      />
      {(from || to) && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear date filter"
          className="text-stone-400 hover:text-red-400 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
