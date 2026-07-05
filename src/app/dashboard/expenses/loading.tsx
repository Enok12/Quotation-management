import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ExpensesLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} cols={5} widths={["w-20", "w-32", "w-40", "w-24", "w-20"]} />
    </div>
  );
}
