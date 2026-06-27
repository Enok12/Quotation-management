import { PageHeaderSkeleton, TabsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="px-8 py-8 max-w-6xl">
      <PageHeaderSkeleton />
      <TabsSkeleton count={5} />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
