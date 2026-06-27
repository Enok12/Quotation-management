import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="px-8 py-8 max-w-6xl">
      <PageHeaderSkeleton action />
      <TableSkeleton rows={10} cols={7} header />
    </div>
  );
}
