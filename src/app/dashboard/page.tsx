import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Users, FileText, Package, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { ReceiptStatusBadge, OrderStatusBadge } from "@/components/receipts/status-badges";

async function getStats() {
  const [
    totalCustomers, draftReceipts, finalizedReceipts,
    pendingOrders, inProgressOrders, completedOrders, cancelledOrders,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.receipt.count({ where: { status: "DRAFT" } }),
    prisma.receipt.count({ where: { status: "FINALIZED" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "PENDING" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "IN_PROGRESS" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "COMPLETED" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "CANCELLED" } }),
  ]);
  return { totalCustomers, draftReceipts, finalizedReceipts, pendingOrders, inProgressOrders, completedOrders, cancelledOrders };
}

async function getRecentReceipts() {
  return prisma.receipt.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, receiptNumber: true, custName: true, date: true,
      totalDue: true, balance: true, status: true, orderStatus: true,
    },
  });
}

export default async function DashboardPage() {
  await requireUser();
  const [stats, recent] = await Promise.all([getStats(), getRecentReceipts()]);

  const statCards = [
    { label: "Customers", value: stats.totalCustomers, icon: Users, href: "/dashboard/customers", color: "text-stone-600" },
    { label: "Total Receipts", value: stats.draftReceipts + stats.finalizedReceipts, icon: FileText, href: "/dashboard/receipts", color: "text-stone-600" },
    { label: "Draft", value: stats.draftReceipts, icon: Clock, href: "/dashboard/receipts?status=DRAFT", color: "text-stone-500" },
    { label: "Finalized", value: stats.finalizedReceipts, icon: CheckCircle, href: "/dashboard/receipts?status=FINALIZED", color: "text-amber-500" },
    { label: "Pending Orders", value: stats.pendingOrders, icon: AlertCircle, href: "/dashboard/orders?status=PENDING", color: "text-blue-500" },
    { label: "In Progress", value: stats.inProgressOrders, icon: TrendingUp, href: "/dashboard/orders?status=IN_PROGRESS", color: "text-violet-500" },
    { label: "Completed", value: stats.completedOrders, icon: CheckCircle, href: "/dashboard/orders?status=COMPLETED", color: "text-emerald-600" },
    { label: "Cancelled", value: stats.cancelledOrders, icon: XCircle, href: "/dashboard/orders?status=CANCELLED", color: "text-stone-400" },
  ];

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">Overview of your business</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold tracking-wider uppercase text-stone-400">{s.label}</span>
              <s.icon size={16} className={s.color} />
            </div>
            <div className="font-serif text-3xl text-ink">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* Recent receipts */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent Receipts</h2>
          <Link href="/dashboard/receipts" className="text-xs text-amber-600 hover:text-amber-500">
            View all →
          </Link>
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
                <th className="th text-left">Receipt</th>
                <th className="th text-left">Order</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="td text-center text-stone-400 py-8">
                    No receipts yet.{" "}
                    <Link href="/dashboard/receipts/new" className="text-amber-600 hover:underline">
                      Create one
                    </Link>
                  </td>
                </tr>
              )}
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-stone-25 transition-colors">
                  <td className="td font-mono text-stone-500 text-xs">#{r.receiptNumber}</td>
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
      </div>
    </div>
  );
}
