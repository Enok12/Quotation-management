import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/receipts/status-badges";
import { CustomerSearch } from "@/components/customers/customer-search";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { LinkButton } from "@/components/ui/link-button";
import { dateRangeFilter } from "@/lib/utils/date-range";

interface Props {
  searchParams: Promise<{ page?: string; status?: string; orderStatus?: string; search?: string; from?: string; to?: string }>;
}
export const metadata = { title: "Receipts" };

export default async function ReceiptsPage({ searchParams }: Props) {
  const { businessId } = await requireBusiness();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const search = sp.search?.trim() ?? "";
  const dateWhere = dateRangeFilter(sp.from, sp.to);

  const where = {
    businessId,
    ...(sp.orderStatus ? { orderStatus: sp.orderStatus as "FABRIC_SELECTION" | "CUTTING" | "PRODUCTION" | "QUALITY_CHECK" | "IRON_PACKING" | "DELIVERY" | "COMPLETED" } : {}),
    ...(search ? { custName: { contains: search, mode: "insensitive" as const } } : {}),
    ...(dateWhere ? { date: dateWhere } : {}),
  };

  const [total, receipts] = await Promise.all([
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, receiptNumber: true, custName: true, date: true,
        totalDue: true, balance: true, paymentStatus: true, orderStatus: true, createdAt: true,
      },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  const filterTab = (label: string, value: string | null, key: "status" | "orderStatus") => {
    const active = sp[key] === value || (value === null && !sp[key]);
    const params = new URLSearchParams();
    if (sp.search) params.set("search", sp.search);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (key === "status" && value) params.set("status", value);
    if (key === "orderStatus" && value) params.set("orderStatus", value);
    return { label, href: `/dashboard/receipts?${params}`, active };
  };

  const orderTabs = [
    filterTab("All Orders", null, "orderStatus"),
    filterTab("Fabric Selection", "FABRIC_SELECTION", "orderStatus"),
    filterTab("Cutting", "CUTTING", "orderStatus"),
    filterTab("Production", "PRODUCTION", "orderStatus"),
    filterTab("Quality Check", "QUALITY_CHECK", "orderStatus"),
    filterTab("Iron / Packing", "IRON_PACKING", "orderStatus"),
    filterTab("Delivery", "DELIVERY", "orderStatus"),
    filterTab("Completed", "COMPLETED", "orderStatus"),
  ];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Receipts</h1>
          <p className="text-stone-500 text-sm mt-1">{total.toLocaleString()} total</p>
        </div>
        <LinkButton href="/dashboard/receipts/new" className="btn-primary self-start" icon={<Plus size={15} />}>
          New Receipt
        </LinkButton>
      </div>

      {/* Filters + table (the shell shows a loading overlay while switching) */}
      <FilterTableShell groups={[orderTabs]}>
      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-3">
          <CustomerSearch defaultValue={search} />
          <DateRangeFilter />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left w-20">#</th>
                <th className="th text-left">Customer</th>
                <th className="th text-left">Date</th>
                <th className="th text-right">Total Due</th>
                <th className="th text-right">Balance</th>
                <th className="th text-left">Payment</th>
                <th className="th text-left">Order</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-stone-400 py-10">No receipts found.</td></tr>
              )}
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-mono text-xs text-stone-500">#{r.receiptNumber}</td>
                  <td className="td font-medium">
                    <Link href={`/dashboard/receipts/${r.id}`} className="hover:text-amber-600 transition-colors">
                      {r.custName}
                    </Link>
                  </td>
                  <td className="td text-stone-500">{fmtDate(r.date)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.totalDue)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.balance)}</td>
                  <td className="td"><PaymentStatusBadge status={r.paymentStatus} /></td>
                  <td className="td"><OrderStatusBadge status={r.orderStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/receipts?page=${page - 1}&${new URLSearchParams(sp as Record<string, string>)}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/receipts?page=${page + 1}&${new URLSearchParams(sp as Record<string, string>)}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
      </FilterTableShell>
    </div>
  );
}
