import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Recent receipts */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {Array.from({ length: 7 }).map((_, c) => (
                  <th key={c} className="th text-left">
                    <Skeleton className="h-3 w-14" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, r) => (
                <tr key={r}>
                  {Array.from({ length: 7 }).map((_, c) => (
                    <td key={c} className="td">
                      <Skeleton className={c === 1 ? "h-3.5 w-40" : "h-3.5 w-16"} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
