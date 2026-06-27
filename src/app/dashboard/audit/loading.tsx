import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function AuditLoading() {
  return (
    <div className="px-8 py-8 max-w-5xl">
      <PageHeaderSkeleton />
      <TableSkeleton rows={12} cols={4} widths={["w-28", "w-32", "w-24", "w-20"]} />
    </div>
  );
}
