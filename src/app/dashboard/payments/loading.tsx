import { PageHeaderSkeleton, TabsSkeleton, TableSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function PaymentsLoading() {
  return (
    <div className="px-8 py-8 max-w-6xl">
      <PageHeaderSkeleton />
      <div className="card card-body mb-6">
        <Skeleton className="h-10 w-full" />
      </div>
      <TabsSkeleton count={4} />
      <TableSkeleton rows={10} cols={7} />
    </div>
  );
}
