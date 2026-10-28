import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { saleService } from "@/server/services/sale.service";
import { codService } from "@/server/services/cod.service";
import { BusinessCodForm } from "@/components/settings/business-cod-form";
import { inventoryService } from "@/server/services/inventory.service";
import { fmtMoney } from "@/lib/utils/format";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { RecordSaleButton } from "@/components/sales/record-sale-button";
import { SaleRow } from "@/components/sales/sale-row";

interface Props { searchParams: Promise<{ from?: string; to?: string }> }
export const metadata = { title: "Sales" };

export default async function SalesPage({ searchParams }: Props) {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "SALES")) return <SectionUnavailable section="Sales" />;
  const sp = await searchParams;

  const [salesRaw, products, business] = await Promise.all([
    saleService.list(businessId, { from: sp.from, to: sp.to }),
    inventoryService.list(businessId),
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { codEnabled: true, codRefusalWarnThreshold: true, name: true } }),
  ]);
  const codSummary = business.codEnabled ? await codService.summary(businessId) : null;

  const sales = salesRaw.map((s) => ({
    id: s.id,
    items: s.items.map((i) => {
      const returnedQuantity = i.returns.reduce((sum, r) => sum + r.quantity, 0);
      return {
        id: i.id, sku: i.product.sku, productName: i.product.name, quantity: i.quantity,
        unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal),
        profit: (Number(i.unitPrice) - Number(i.costPriceAtSale)) * i.quantity,
        returnedQuantity, returnable: i.quantity - returnedQuantity,
      };
    }),
    totalAmount: Number(s.totalAmount),
    paymentMethod: s.paymentMethod, note: s.note,
    soldBy: s.soldBy.name ?? s.soldBy.email,
    // A COD sale is dated by its delivery — that's when it became revenue.
    createdAt: (s.delivery?.deliveredAt ?? s.createdAt).toISOString(),
    cod: s.delivery
      ? { dispatchRef: s.delivery.dispatchRef, status: s.delivery.status, deliveryCost: s.delivery.feePaidBy === "BUSINESS" ? Number(s.delivery.deliveryFee) : 0 }
      : null,
  }));

  const unitsSold = sales.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.quantity, 0), 0);
  const revenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  // Delivery cost the seller absorbed on COD sales comes straight off profit.
  const profit = sales.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.profit, 0) - (s.cod?.deliveryCost ?? 0), 0);
  const profitClass = profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Sales</h1>
          <p className="text-stone-500 text-sm mt-1">Manually recorded retail sales</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter />
          <RecordSaleButton
            codEnabled={business.codEnabled}
            businessName={business.name}
            products={products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, sellingPrice: Number(p.sellingPrice), quantityOnHand: p.quantityOnHand }))}
          />
        </div>
      </div>

      {/* A retail-only plan has no Settings section, so the admin can switch
          COD on right here too. Once it's on, the toggle lives on the COD page. */}
      {!business.codEnabled && role === "ADMIN" && (
        <div className="card card-body mb-6">
          <h2 className="heading-2 mb-1">Cash on Delivery</h2>
          <p className="text-sm text-stone-500 mb-4">
            Sell parcels that a courier delivers and collects payment for. Switching it on adds a COD Orders page and a
            Cash on Delivery option when you record a sale.
          </p>
          <BusinessCodForm initialEnabled={business.codEnabled} initialThreshold={business.codRefusalWarnThreshold} />
        </div>
      )}

      {/* Summary */}
      <div className={`grid grid-cols-2 gap-4 mb-8 ${codSummary ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Sales</span>
          <div className="font-serif text-3xl text-ink mt-2">{sales.length}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Units Sold</span>
          <div className="font-serif text-3xl text-ink mt-2">{unitsSold}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Revenue</span>
          <div className="font-serif text-3xl text-ink mt-2">{fmtMoney(revenue)}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Profit</span>
          <div className={`font-serif text-3xl mt-2 ${profitClass}`}>{fmtMoney(profit)}</div>
        </div>
        {codSummary && (
          <Link href="/dashboard/retail/cod?tab=receivable" className="card p-5 hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">COD Receivable</span>
            <div className="font-serif text-3xl text-ink mt-2">{fmtMoney(codSummary.receivable)}</div>
            <span className="text-xs text-stone-400">{codSummary.receivableCount} delivered, awaiting courier</span>
          </Link>
        )}
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-8"></th>
                <th className="th text-left">Date</th>
                <th className="th text-left">Products</th>
                <th className="th text-right">Units</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Profit</th>
                <th className="th text-left">Payment</th>
                <th className="th text-left">Sold By</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={8} className="td text-center text-stone-400 py-10">No sales recorded yet.</td></tr>
              )}
              {sales.map((s) => <SaleRow key={s.id} sale={s} />)}
            </tbody>
            {sales.length > 0 && (
              <tfoot>
                <tr className="bg-stone-25 dark:bg-white/[0.02] font-semibold">
                  <td colSpan={3} className="td text-right text-ink">Total</td>
                  <td className="td text-right font-mono">{unitsSold}</td>
                  <td className="td text-right font-mono">{fmtMoney(revenue)}</td>
                  <td className={`td text-right font-mono ${profitClass}`}>{fmtMoney(profit)}</td>
                  <td colSpan={2} className="td"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
