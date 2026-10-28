import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function InventoryLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-24 mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <TableSkeleton rows={10} cols={7} />
    </div>
  );
}
