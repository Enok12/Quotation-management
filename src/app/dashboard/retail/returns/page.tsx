import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { returnService } from "@/server/services/return.service";
import { fmtMoney, fmtDateTime } from "@/lib/utils/format";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";

interface Props { searchParams: Promise<{ from?: string; to?: string }> }
export const metadata = { title: "Returns" };

export default async function ReturnsPage({ searchParams }: Props) {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "SALES")) return <SectionUnavailable section="Sales" />;
  const sp = await searchParams;

  const returns = await returnService.list(businessId, { from: sp.from, to: sp.to });
  const unitsReturned = returns.reduce((sum, r) => sum + r.quantity, 0);
  const refundTotal = returns.reduce((sum, r) => sum + Number(r.refundAmount), 0);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Returns</h1>
          <p className="text-stone-500 text-sm mt-1">Processed from a sale's product line — see Sales</p>
        </div>
        <DateRangeFilter />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Returns</span>
          <div className="font-serif text-3xl text-ink mt-2">{returns.length}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Units Returned</span>
          <div className="font-serif text-3xl text-ink mt-2">{unitsReturned}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Refund Total</span>
          <div className="font-serif text-3xl text-red-600 dark:text-red-400 mt-2">{fmtMoney(refundTotal)}</div>
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Date</th>
                <th className="th text-left">SKU</th>
                <th className="th text-left">Product</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Refund</th>
                <th className="th text-left">Reason</th>
                <th className="th text-left">Note</th>
                <th className="th text-left">Processed By</th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 && (
                <tr><td colSpan={8} className="td text-center text-stone-400 py-10">No returns in this period.</td></tr>
              )}
              {returns.map((r) => (
                <tr key={r.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td text-xs text-stone-500 whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="td"><code className="font-mono text-sm">{r.product.sku}</code></td>
                  <td className="td">{r.product.name}</td>
                  <td className="td text-right font-mono text-sm">{r.quantity}</td>
                  <td className="td text-right font-mono text-sm text-red-600 dark:text-red-400">{fmtMoney(r.refundAmount)}</td>
                  <td className="td text-sm">{r.reason}</td>
                  <td className="td text-xs text-stone-400">{r.note ?? "—"}</td>
                  <td className="td text-xs text-stone-500">{r.processedBy.name ?? r.processedBy.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
