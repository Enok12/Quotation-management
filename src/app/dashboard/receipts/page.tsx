import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { ReceiptStatusBadge, OrderStatusBadge } from "@/components/receipts/status-badges";
import { CustomerSearch } from "@/components/customers/customer-search";

interface Props {
  searchParams: Promise<{ page?: string; status?: string; orderStatus?: string; search?: string }>;
}
export const metadata = { title: "Receipts" };

export default async function ReceiptsPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const search = sp.search?.trim() ?? "";

  const where = {
    ...(sp.status ? { status: sp.status as "DRAFT" | "FINALIZED" } : {}),
    ...(sp.orderStatus ? { orderStatus: sp.orderStatus as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } : {}),
    ...(search ? { custName: { contains: search, mode: "insensitive" as const } } : {}),
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
        totalDue: true, balance: true, status: true, orderStatus: true, createdAt: true,
      },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  const filterTab = (label: string, value: string | null, key: "status" | "orderStatus") => {
    const active = sp[key] === value || (value === null && !sp[key]);
    const params = new URLSearchParams();
    if (sp.search) params.set("search", sp.search);
    if (key === "status" && value) params.set("status", value);
    if (key === "orderStatus" && value) params.set("orderStatus", value);
    return { label, href: `/dashboard/receipts?${params}`, active };
  };

  const statusTabs = [
    filterTab("All", null, "status"),
    filterTab("Draft", "DRAFT", "status"),
    filterTab("Finalized", "FINALIZED", "status"),
  ];
  const orderTabs = [
    filterTab("All Orders", null, "orderStatus"),
    filterTab("Pending", "PENDING", "orderStatus"),
    filterTab("In Progress", "IN_PROGRESS", "orderStatus"),
    filterTab("Completed", "COMPLETED", "orderStatus"),
    filterTab("Cancelled", "CANCELLED", "orderStatus"),
  ];

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Receipts</h1>
          <p className="text-stone-500 text-sm mt-1">{total.toLocaleString()} total</p>
        </div>
        <Link href="/dashboard/receipts/new" className="btn-primary">
          <Plus size={15} /> New Receipt
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex gap-1">
          {statusTabs.map((t) => (
            <Link key={t.label} href={t.href} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${t.active ? "bg-ink text-white" : "text-stone-500 hover:bg-stone-100"}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="w-px h-4 bg-stone-200" />
        <div className="flex gap-1">
          {orderTabs.map((t) => (
            <Link key={t.label} href={t.href} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${t.active ? "bg-ink text-white" : "text-stone-500 hover:bg-stone-100"}`}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <CustomerSearch defaultValue={search} />
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
                <th className="th text-left">Status</th>
                <th className="th text-left">Order</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-stone-400 py-10">No receipts found.</td></tr>
              )}
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-stone-25 transition-colors">
                  <td className="td font-mono text-xs text-stone-500">#{r.receiptNumber}</td>
                  <td className="td font-medium">
                    <Link href={`/dashboard/receipts/${r.id}`} className="hover:text-amber-600 transition-colors">
                      {r.custName}
                    </Link>
                  </td>
                  <td className="td text-stone-500">{fmtDate(r.date)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.totalDue)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.balance)}</td>
                  <td className="td"><ReceiptStatusBadge status={r.status} /></td>
                  <td className="td"><OrderStatusBadge status={r.orderStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/receipts?page=${page - 1}&${new URLSearchParams(sp as Record<string, string>)}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/receipts?page=${page + 1}&${new URLSearchParams(sp as Record<string, string>)}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
