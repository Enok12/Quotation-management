import { PageHeaderSkeleton, TabsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ReceiptsLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <PageHeaderSkeleton action />
      {/* status + order-status filter groups */}
      <div className="flex items-center gap-6 mb-4">
        <TabsSkeleton count={3} />
        <TabsSkeleton count={5} />
      </div>
      <TableSkeleton rows={10} cols={7} header />
    </div>
  );
}
