import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import Link from "next/link";
import { Users, FileText, Package, CheckCircle, Layers, Scissors, Factory, ShieldCheck, Truck, Boxes, FlaskConical, PartyPopper, HelpCircle } from "lucide-react";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { PaymentStatusBadge, OrderStatusBadge } from "@/components/receipts/status-badges";

async function getStats(businessId: string) {
  const [totalCustomers, totalReceipts, unconfirmed, bulk, sample, completed, byStage] = await Promise.all([
    prisma.customer.count({ where: { businessId } }),
    prisma.receipt.count({ where: { businessId } }),
    prisma.receipt.count({ where: { businessId, orderType: "BULK", receiptNumber: null } }),
    prisma.receipt.count({ where: { businessId, orderType: "BULK", receiptNumber: { not: null }, paymentStatus: { not: "PAID" } } }),
    prisma.receipt.count({ where: { businessId, orderType: "SAMPLE" } }),
    prisma.receipt.count({ where: { businessId, orderType: "BULK", paymentStatus: "PAID" } }),
    // Item-level, not receipt-level — a 5-item order has 5 pieces counted
    // across whichever stages they're each individually at.
    prisma.receiptItem.groupBy({ by: ["orderStatus"], _count: true, where: { receipt: { businessId } } }),
  ]);
  const stage = (s: string) => byStage.find((b) => b.orderStatus === s)?._count ?? 0;
  return {
    totalCustomers, totalReceipts,
    unconfirmed, bulk, sample, completed,
    fabric: stage("FABRIC_SELECTION"),
    cutting: stage("CUTTING"),
    production: stage("PRODUCTION"),
    qc: stage("QUALITY_CHECK"),
    packing: stage("IRON_PACKING"),
    delivery: stage("DELIVERY"),
    orderCompleted: stage("COMPLETED"),
  };
}

async function getRecentReceipts(businessId: string) {
  return prisma.receipt.findMany({
    where: { businessId },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, receiptNumber: true, custName: true, date: true,
      totalDue: true, balance: true, paymentStatus: true, orderStatus: true,
    },
  });
}

export default async function DashboardPage() {
  const { businessId } = await requireBusiness();
  const [stats, recent] = await Promise.all([getStats(businessId), getRecentReceipts(businessId)]);

  const statCards = [
    { label: "Customers", value: stats.totalCustomers, icon: Users, href: "/dashboard/customers", color: "text-stone-600" },
    { label: "Total Receipts", value: stats.totalReceipts, icon: FileText, href: "/dashboard/receipts", color: "text-stone-600" },
    { label: "Unconfirmed", value: stats.unconfirmed, icon: HelpCircle, href: "/dashboard/payments?folder=UNCONFIRMED", color: "text-amber-500" },
    { label: "Bulk Orders", value: stats.bulk, icon: Boxes, href: "/dashboard/payments?folder=BULK", color: "text-blue-500" },
    { label: "Sample Orders", value: stats.sample, icon: FlaskConical, href: "/dashboard/payments?folder=SAMPLE", color: "text-purple-500" },
    { label: "Completed", value: stats.completed, icon: CheckCircle, href: "/dashboard/payments?folder=COMPLETED", color: "text-emerald-600" },
    { label: "Fabric Selection", value: stats.fabric, icon: Layers, href: "/dashboard/orders?status=FABRIC_SELECTION", color: "text-sky-500" },
    { label: "Cutting", value: stats.cutting, icon: Scissors, href: "/dashboard/orders?status=CUTTING", color: "text-amber-500" },
    { label: "Production", value: stats.production, icon: Factory, href: "/dashboard/orders?status=PRODUCTION", color: "text-violet-500" },
    { label: "Quality Check", value: stats.qc, icon: ShieldCheck, href: "/dashboard/orders?status=QUALITY_CHECK", color: "text-indigo-500" },
    { label: "Iron / Packing", value: stats.packing, icon: Package, href: "/dashboard/orders?status=IRON_PACKING", color: "text-orange-500" },
    { label: "Delivery", value: stats.delivery, icon: Truck, href: "/dashboard/orders?status=DELIVERY", color: "text-emerald-600" },
    { label: "Order Completed", value: stats.orderCompleted, icon: PartyPopper, href: "/dashboard/orders?status=COMPLETED", color: "text-teal-600" },
  ];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">Overview of your business</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
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
                  <td className="td font-mono text-stone-500 text-xs">
                    {r.receiptNumber !== null ? `#${r.receiptNumber}` : <span className="text-amber-600">Unconfirmed</span>}
                  </td>
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
