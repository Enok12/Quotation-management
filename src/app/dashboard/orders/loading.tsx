import { PageHeaderSkeleton, TabsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <PageHeaderSkeleton />
      <TabsSkeleton count={5} />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
