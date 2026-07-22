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

interface Props { searchParams: Promise<{ status?: string; page?: string; from?: string; to?: string; search?: string }> }
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
  const dateWhere = dateRangeFilter(sp.from, sp.to);
  const search = sp.search?.trim() ?? "";

  const where = {
    businessId,
    status: "FINALIZED" as const,
    // Unconfirmed orders (no advance paid yet) don't show up here — nothing
    // to put into production until the order is actually confirmed.
    receiptNumber: { not: null },
    ...(orderStatus ? { orderStatus } : {}),
    ...(dateWhere ? { date: dateWhere } : {}),
    ...(search ? { custName: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.receipt.count({ where }),
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
  const totalPages = Math.ceil(total / pageSize);

  const tabHref = (status?: string) => `/dashboard/orders?${buildQuery({ status, from: sp.from, to: sp.to, search: sp.search })}`;
  const tabs = [
    { label: "All", href: tabHref(), active: !orderStatus },
    { label: "Fabric Selection", href: tabHref("FABRIC_SELECTION"), active: orderStatus === "FABRIC_SELECTION" },
    { label: "Cutting", href: tabHref("CUTTING"), active: orderStatus === "CUTTING" },
    { label: "Production", href: tabHref("PRODUCTION"), active: orderStatus === "PRODUCTION" },
    { label: "Quality Check", href: tabHref("QUALITY_CHECK"), active: orderStatus === "QUALITY_CHECK" },
    { label: "Iron / Packing", href: tabHref("IRON_PACKING"), active: orderStatus === "IRON_PACKING" },
    { label: "Delivery", href: tabHref("DELIVERY"), active: orderStatus === "DELIVERY" },
    { label: "Completed", href: tabHref("COMPLETED"), active: orderStatus === "COMPLETED" },
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

      <FilterTableShell groups={[tabs]}>
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
                />
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/orders?${buildQuery({ page: String(page - 1), status: orderStatus, from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/orders?${buildQuery({ page: String(page + 1), status: orderStatus, from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
      </FilterTableShell>
    </div>
  );
}
