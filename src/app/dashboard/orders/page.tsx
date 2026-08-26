import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import Link from "next/link";
import { ExpandableOrderRow } from "@/components/receipts/expandable-order-row";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomerSearch } from "@/components/customers/customer-search";
import { dateRangeFilter, buildQuery } from "@/lib/utils/date-range";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";

interface Props { searchParams: Promise<{ status?: string; type?: string; page?: string; from?: string; to?: string; search?: string }> }
export const metadata = { title: "Production" };

export default async function OrdersPage({ searchParams }: Props) {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "PRODUCTION")) return <SectionUnavailable section="Production" />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const orderStatus = sp.status as
    | "FABRIC_SELECTION" | "CUTTING" | "PRODUCTION" | "QUALITY_CHECK" | "IRON_PACKING" | "DELIVERY" | "COMPLETED"
    | undefined;
  const type = (sp.type === "BULK" || sp.type === "SAMPLE" ? sp.type : undefined) as "BULK" | "SAMPLE" | undefined;
  const dateWhere = dateRangeFilter(sp.from, sp.to);
  const search = sp.search?.trim() ?? "";

  // Everything EXCEPT the order-type filter — drives both the paginated query
  // and the per-type counts (each type's count reflects the other active filters).
  const baseWhere = {
    businessId,
    status: "FINALIZED" as const,
    // Unconfirmed orders (no advance paid yet) don't show up here — nothing
    // to put into production until the order is actually confirmed.
    receiptNumber: { not: null },
    ...(orderStatus ? { orderStatus } : {}),
    ...(dateWhere ? { date: dateWhere } : {}),
    ...(search ? { custName: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const where = { ...baseWhere, ...(type ? { orderType: type } : {}) };

  const [bulkCount, sampleCount, orders] = await Promise.all([
    prisma.receipt.count({ where: { ...baseWhere, orderType: "BULK" } }),
    prisma.receipt.count({ where: { ...baseWhere, orderType: "SAMPLE" } }),
    prisma.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, receiptNumber: true, custName: true, date: true, orderType: true,
        totalDue: true, balance: true,
      },
    }),
  ]);
  const total = type === "BULK" ? bulkCount : type === "SAMPLE" ? sampleCount : bulkCount + sampleCount;
  const totalPages = Math.ceil(total / pageSize);

  // Each tab preserves the OTHER filter dimension (status tabs keep the current
  // type, type tabs keep the current status) plus search/date.
  const statusHref = (status?: string) => `/dashboard/orders?${buildQuery({ status, type: sp.type, from: sp.from, to: sp.to, search: sp.search })}`;
  const typeHref = (t?: string) => `/dashboard/orders?${buildQuery({ type: t, status: sp.status, from: sp.from, to: sp.to, search: sp.search })}`;

  const typeTabs = [
    { label: "All Orders", href: typeHref(), active: !type, count: bulkCount + sampleCount },
    { label: "Bulk", href: typeHref("BULK"), active: type === "BULK", count: bulkCount },
    { label: "Sample", href: typeHref("SAMPLE"), active: type === "SAMPLE", count: sampleCount },
  ];

  const tabs = [
    { label: "All", href: statusHref(), active: !orderStatus },
    { label: "Fabric Selection", href: statusHref("FABRIC_SELECTION"), active: orderStatus === "FABRIC_SELECTION" },
    { label: "Cutting", href: statusHref("CUTTING"), active: orderStatus === "CUTTING" },
    { label: "Production", href: statusHref("PRODUCTION"), active: orderStatus === "PRODUCTION" },
    { label: "Quality Check", href: statusHref("QUALITY_CHECK"), active: orderStatus === "QUALITY_CHECK" },
    { label: "Iron / Packing", href: statusHref("IRON_PACKING"), active: orderStatus === "IRON_PACKING" },
    { label: "Delivery", href: statusHref("DELIVERY"), active: orderStatus === "DELIVERY" },
    { label: "Completed", href: statusHref("COMPLETED"), active: orderStatus === "COMPLETED" },
  ];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Production</h1>
        <p className="text-stone-500 text-sm mt-1">{total.toLocaleString()} orders in production</p>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <CustomerSearch defaultValue={search} placeholder="Search by customer name…" />
        <DateRangeFilter />
      </div>

      <FilterTableShell groups={[typeTabs, tabs]}>
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-8"></th>
                <th className="th text-left w-20">#</th>
                <th className="th text-left">Customer</th>
                <th className="th text-left">Date</th>
                <th className="th text-right">Total Due</th>
                <th className="th text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={6} className="td text-center text-stone-400 py-10">No orders found.</td></tr>
              )}
              {orders.map((r) => (
                <ExpandableOrderRow
                  key={r.id}
                  receiptId={r.id}
                  receiptNumber={r.receiptNumber as number}
                  orderType={r.orderType}
                  custName={r.custName}
                  date={r.date}
                  totalDue={Number(r.totalDue)}
                  balance={Number(r.balance)}
                  isAdmin={role === "ADMIN"}
                />
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/orders?${buildQuery({ page: String(page - 1), status: orderStatus, type: sp.type, from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/orders?${buildQuery({ page: String(page + 1), status: orderStatus, type: sp.type, from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
      </FilterTableShell>
    </div>
  );
}
