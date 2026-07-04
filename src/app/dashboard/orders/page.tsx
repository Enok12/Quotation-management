import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { OrderStatusSelect } from "@/components/receipts/order-status-select";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomerSearch } from "@/components/customers/customer-search";
import { dateRangeFilter, buildQuery } from "@/lib/utils/date-range";

interface Props { searchParams: Promise<{ status?: string; page?: string; from?: string; to?: string; search?: string }> }
export const metadata = { title: "Production" };

export default async function OrdersPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const orderStatus = sp.status as
    | "FABRIC_SELECTION" | "CUTTING" | "PRODUCTION" | "QUALITY_CHECK" | "IRON_PACKING" | "DELIVERY"
    | undefined;
  const dateWhere = dateRangeFilter(sp.from, sp.to);
  const search = sp.search?.trim() ?? "";

  const where = {
    status: "FINALIZED" as const,
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
        id: true, receiptNumber: true, custName: true, date: true,
        totalDue: true, balance: true, orderStatus: true, finalizedAt: true,
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
  ];

  return (
    <div className="px-8 py-8 max-w-6xl">
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
        <table className="w-full">
          <thead>
            <tr>
              <th className="th text-left w-20">#</th>
              <th className="th text-left">Customer</th>
              <th className="th text-left">Date</th>
              <th className="th text-right">Total Due</th>
              <th className="th text-right">Balance</th>
              <th className="th text-left">Order Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="td text-center text-stone-400 py-10">No orders found.</td></tr>
            )}
            {orders.map((r) => (
              <tr key={r.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                <td className="td font-mono text-xs text-stone-500">#{r.receiptNumber}</td>
                <td className="td font-medium">
                  <Link href={`/dashboard/receipts/${r.id}`} className="hover:text-amber-600 transition-colors">
                    {r.custName}
                  </Link>
                </td>
                <td className="td text-stone-500">{fmtDate(r.date)}</td>
                <td className="td text-right font-mono">{fmtMoney(r.totalDue)}</td>
                <td className="td text-right font-mono">{fmtMoney(r.balance)}</td>
                <td className="td"><OrderStatusSelect receiptId={r.id} status={r.orderStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
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
