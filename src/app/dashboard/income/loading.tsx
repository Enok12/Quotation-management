import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function IncomeLoading() {
  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-9 w-64 rounded-md" />
      </div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-24 mt-3" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={8} cols={7} header />
    </div>
  );
}
