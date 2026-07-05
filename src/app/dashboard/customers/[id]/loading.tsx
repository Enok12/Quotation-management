import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function CustomerDetailLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">
      <Skeleton className="h-6 w-24 mb-6 rounded" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-40 mt-2" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Contact details */}
        <div className="lg:col-span-2 card card-body space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28 mt-2" />
              </div>
            ))}
          </div>
        </div>
        {/* Summary card */}
        <div className="card card-body space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
