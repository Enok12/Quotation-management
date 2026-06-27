import { cn } from "@/lib/utils/cn";

/** A single shimmering placeholder block. Size it with className (e.g. "h-4 w-32"). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

/** Page title + subtitle placeholder, matching the standard list-page header. */
export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-28 mt-2" />
      </div>
      {action && <Skeleton className="h-9 w-32 rounded-md" />}
    </div>
  );
}

/** A row of pill-shaped filter-tab placeholders. */
export function TabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-1 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-20 rounded" />
      ))}
    </div>
  );
}

/**
 * A card-wrapped table skeleton. `widths` controls the placeholder width per
 * column (cycled if shorter than `cols`); defaults to a sensible mix.
 */
export function TableSkeleton({
  rows = 8,
  cols = 6,
  header = false,
  widths,
}: {
  rows?: number;
  cols?: number;
  header?: boolean;
  widths?: string[];
}) {
  const colWidth = (c: number) =>
    widths ? widths[c % widths.length] : c === 1 ? "w-40" : "w-16";

  return (
    <div className="card">
      {header && (
        <div className="card-header">
          <Skeleton className="h-9 w-72 max-w-full rounded-md" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, c) => (
                <th key={c} className="th text-left">
                  <Skeleton className="h-3 w-14" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="td">
                    <Skeleton className={cn("h-3.5", colWidth(c))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
