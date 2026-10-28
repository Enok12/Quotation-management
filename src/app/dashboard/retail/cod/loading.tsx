import { Skeleton, TableSkeleton, TabsSkeleton } from "@/components/ui/skeleton";

export default function CodOrdersLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="mb-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-24 mt-3" />
            <Skeleton className="h-3 w-32 mt-2" />
          </div>
        ))}
      </div>
      <TabsSkeleton count={7} />
      <Skeleton className="h-9 w-full max-w-md rounded-md mb-4" />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
