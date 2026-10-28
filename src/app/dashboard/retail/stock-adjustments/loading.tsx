import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function StockAdjustmentsLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-9 w-56 rounded-md" />
      </div>
      <TableSkeleton rows={10} cols={8} />
    </div>
  );
}
