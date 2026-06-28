import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { OrderStatusBadge } from "@/components/receipts/status-badges";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";

interface Props { searchParams: Promise<{ status?: string; page?: string }> }
export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const orderStatus = sp.status as
    | "FABRIC_SELECTION" | "CUTTING" | "PRODUCTION" | "QUALITY_CHECK" | "IRON_PACKING" | "DELIVERY"
    | undefined;

  const where = {
    status: "FINALIZED" as const,
    ...(orderStatus ? { orderStatus } : {}),
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

  const tabs = [
    { label: "All", href: "/dashboard/orders", active: !orderStatus },
    { label: "Fabric Selection", href: "/dashboard/orders?status=FABRIC_SELECTION", active: orderStatus === "FABRIC_SELECTION" },
    { label: "Cutting", href: "/dashboard/orders?status=CUTTING", active: orderStatus === "CUTTING" },
    { label: "Production", href: "/dashboard/orders?status=PRODUCTION", active: orderStatus === "PRODUCTION" },
    { label: "Quality Check", href: "/dashboard/orders?status=QUALITY_CHECK", active: orderStatus === "QUALITY_CHECK" },
    { label: "Iron / Packing", href: "/dashboard/orders?status=IRON_PACKING", active: orderStatus === "IRON_PACKING" },
    { label: "Delivery", href: "/dashboard/orders?status=DELIVERY", active: orderStatus === "DELIVERY" },
  ];

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Orders</h1>
        <p className="text-stone-500 text-sm mt-1">{total.toLocaleString()} finalized orders</p>
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
              <tr key={r.id} className="hover:bg-stone-25 transition-colors">
                <td className="td font-mono text-xs text-stone-500">#{r.receiptNumber}</td>
                <td className="td font-medium">
                  <Link href={`/dashboard/receipts/${r.id}`} className="hover:text-amber-600 transition-colors">
                    {r.custName}
                  </Link>
                </td>
                <td className="td text-stone-500">{fmtDate(r.date)}</td>
                <td className="td text-right font-mono">{fmtMoney(r.totalDue)}</td>
                <td className="td text-right font-mono">{fmtMoney(r.balance)}</td>
                <td className="td"><OrderStatusBadge status={r.orderStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/orders?page=${page - 1}${orderStatus ? `&status=${orderStatus}` : ""}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/orders?page=${page + 1}${orderStatus ? `&status=${orderStatus}` : ""}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
      </FilterTableShell>
    </div>
  );
}
