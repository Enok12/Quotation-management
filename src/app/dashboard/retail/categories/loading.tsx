import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-52 mt-2" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <TableSkeleton rows={6} cols={3} widths={["w-40", "w-10", "w-16"]} />
    </div>
  );
}
