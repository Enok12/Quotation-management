import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { inventoryService } from "@/server/services/inventory.service";
import { fmtDateTime } from "@/lib/utils/format";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";

interface Props { searchParams: Promise<{ from?: string; to?: string }> }
export const metadata = { title: "Stock Adjustments" };

const TYPE_LABEL: Record<string, string> = { IN: "+ In", OUT: "− Out", ADJUSTMENT: "Adjustment" };
const TYPE_CLASS: Record<string, string> = {
  IN: "text-emerald-600 dark:text-emerald-400",
  OUT: "text-red-600 dark:text-red-400",
  ADJUSTMENT: "text-amber-600 dark:text-amber-400",
};

export default async function StockAdjustmentsPage({ searchParams }: Props) {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "INVENTORY")) return <SectionUnavailable section="Inventory Management" />;
  const sp = await searchParams;

  const movements = await inventoryService.listAllMovements(businessId, { from: sp.from, to: sp.to });

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Stock Adjustments</h1>
          <p className="text-stone-500 text-sm mt-1">{movements.length.toLocaleString()} movements across every product</p>
        </div>
        <DateRangeFilter />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Date</th>
                <th className="th text-left">SKU</th>
                <th className="th text-left">Product</th>
                <th className="th text-left">Type</th>
                <th className="th text-right">Qty</th>
                <th className="th text-left">Reason</th>
                <th className="th text-left">Note</th>
                <th className="th text-left">By</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr><td colSpan={8} className="td text-center text-stone-400 py-10">No stock movements in this period.</td></tr>
              )}
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td text-xs text-stone-500 whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                  <td className="td"><code className="font-mono text-sm">{m.product.sku}</code></td>
                  <td className="td">{m.product.name}</td>
                  <td className={`td text-sm font-medium ${TYPE_CLASS[m.type]}`}>{TYPE_LABEL[m.type]}</td>
                  <td className="td text-right font-mono text-sm">{m.quantity}</td>
                  <td className="td text-sm">{m.reason}</td>
                  <td className="td text-xs text-stone-400">{m.note ?? "—"}</td>
                  <td className="td text-xs text-stone-500">{m.performedBy.name ?? m.performedBy.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
