import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Users, FileText, Package, CheckCircle, Layers, Scissors, Factory, ShieldCheck, Truck, Boxes, FlaskConical } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { PaymentStatusBadge, OrderStatusBadge } from "@/components/receipts/status-badges";

async function getStats() {
  const [totalCustomers, totalReceipts, bulk, sample, completed, byStage] = await Promise.all([
    prisma.customer.count(),
    prisma.receipt.count(),
    prisma.receipt.count({ where: { orderType: "BULK", paymentStatus: { not: "PAID" } } }),
    prisma.receipt.count({ where: { orderType: "SAMPLE" } }),
    prisma.receipt.count({ where: { orderType: "BULK", paymentStatus: "PAID" } }),
    prisma.receipt.groupBy({ by: ["orderStatus"], _count: true }),
  ]);
  const stage = (s: string) => byStage.find((b) => b.orderStatus === s)?._count ?? 0;
  return {
    totalCustomers, totalReceipts,
    bulk, sample, completed,
    fabric: stage("FABRIC_SELECTION"),
    cutting: stage("CUTTING"),
    production: stage("PRODUCTION"),
    qc: stage("QUALITY_CHECK"),
    packing: stage("IRON_PACKING"),
    delivery: stage("DELIVERY"),
  };
}

async function getRecentReceipts() {
  return prisma.receipt.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, receiptNumber: true, custName: true, date: true,
      totalDue: true, balance: true, paymentStatus: true, orderStatus: true,
    },
  });
}

export default async function DashboardPage() {
  await requireUser();
  const [stats, recent] = await Promise.all([getStats(), getRecentReceipts()]);

  const statCards = [
    { label: "Customers", value: stats.totalCustomers, icon: Users, href: "/dashboard/customers", color: "text-stone-600" },
    { label: "Total Receipts", value: stats.totalReceipts, icon: FileText, href: "/dashboard/receipts", color: "text-stone-600" },
    { label: "Bulk Orders", value: stats.bulk, icon: Boxes, href: "/dashboard/payments?folder=BULK", color: "text-blue-500" },
    { label: "Sample Orders", value: stats.sample, icon: FlaskConical, href: "/dashboard/payments?folder=SAMPLE", color: "text-purple-500" },
    { label: "Completed", value: stats.completed, icon: CheckCircle, href: "/dashboard/payments?folder=COMPLETED", color: "text-emerald-600" },
    { label: "Fabric Selection", value: stats.fabric, icon: Layers, href: "/dashboard/orders?status=FABRIC_SELECTION", color: "text-sky-500" },
    { label: "Cutting", value: stats.cutting, icon: Scissors, href: "/dashboard/orders?status=CUTTING", color: "text-amber-500" },
    { label: "Production", value: stats.production, icon: Factory, href: "/dashboard/orders?status=PRODUCTION", color: "text-violet-500" },
    { label: "Quality Check", value: stats.qc, icon: ShieldCheck, href: "/dashboard/orders?status=QUALITY_CHECK", color: "text-indigo-500" },
    { label: "Iron / Packing", value: stats.packing, icon: Package, href: "/dashboard/orders?status=IRON_PACKING", color: "text-orange-500" },
    { label: "Delivery", value: stats.delivery, icon: Truck, href: "/dashboard/orders?status=DELIVERY", color: "text-emerald-600" },
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
                <th className="th text-left">Payment</th>
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
                <tr key={r.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-mono text-stone-500 text-xs">#{r.receiptNumber}</td>
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
      </div>
    </div>
  );
}
