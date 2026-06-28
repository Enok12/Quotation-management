import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { PaymentStatusBadge } from "@/components/receipts/status-badges";
import { FolderSyncPanel } from "@/components/payments/folder-sync-panel";
import type { FolderStatus } from "@/lib/folder-sync";

interface Props { searchParams: Promise<{ status?: string; page?: string }> }
export const metadata = { title: "Payments" };

const STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"] as const;

export default async function PaymentsPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number])
    ? (sp.status as FolderStatus)
    : undefined;

  const baseWhere = { status: "FINALIZED" as const };
  const where = { ...baseWhere, ...(status ? { paymentStatus: status } : {}) };

  const [counts, total, receipts, allForSync] = await Promise.all([
    prisma.receipt.groupBy({ by: ["paymentStatus"], where: baseWhere, _count: true }),
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, receiptNumber: true, custName: true, date: true,
        totalDue: true, advanceAmount: true, amountPaid: true, balance: true, paymentStatus: true,
      },
    }),
    // Lightweight list of every finalized invoice for the "Sync all" reconcile.
    prisma.receipt.findMany({
      where: baseWhere,
      select: { id: true, receiptNumber: true, paymentStatus: true },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  const countFor = (s: string) => counts.find((c) => c.paymentStatus === s)?._count ?? 0;
  const allCount = counts.reduce((sum, c) => sum + (c._count as number), 0);

  const tabs = [
    { label: "All", value: null, count: allCount },
    { label: "Unpaid", value: "UNPAID", count: countFor("UNPAID") },
    { label: "Partial Paid", value: "PARTIALLY_PAID", count: countFor("PARTIALLY_PAID") },
    { label: "Completed", value: "PAID", count: countFor("PAID") },
  ];

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Payments</h1>
        <p className="text-stone-500 text-sm mt-1">Track invoices through Unpaid → Partial Paid → Completed</p>
      </div>

      {/* Computer-folder sync */}
      <div className="mb-6">
        <FolderSyncPanel items={allForSync as { id: string; receiptNumber: number; paymentStatus: FolderStatus }[]} />
      </div>

      {/* Folder tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => {
          const active = (t.value ?? null) === (status ?? null);
          const href = t.value ? `/dashboard/payments?status=${t.value}` : "/dashboard/payments";
          return (
            <Link
              key={t.label}
              href={href}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${active ? "bg-ink text-white" : "text-stone-500 hover:bg-stone-100"}`}
            >
              {t.label}
              <span className={`ml-1.5 ${active ? "text-white/70" : "text-stone-400"}`}>{t.count}</span>
            </Link>
          );
        })}
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th text-left w-20">#</th>
              <th className="th text-left">Customer</th>
              <th className="th text-left">Date</th>
              <th className="th text-right">Total Due</th>
              <th className="th text-right">Paid</th>
              <th className="th text-right">Balance</th>
              <th className="th text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr><td colSpan={7} className="td text-center text-stone-400 py-10">No invoices in this folder.</td></tr>
            )}
            {receipts.map((r) => {
              const paid = Number(r.advanceAmount) + Number(r.amountPaid);
              return (
                <tr key={r.id} className="hover:bg-stone-25 transition-colors">
                  <td className="td font-mono text-xs text-stone-500">#{r.receiptNumber}</td>
                  <td className="td font-medium">
                    <Link href={`/dashboard/receipts/${r.id}`} className="hover:text-amber-600 transition-colors">
                      {r.custName}
                    </Link>
                  </td>
                  <td className="td text-stone-500">{fmtDate(r.date)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.totalDue)}</td>
                  <td className="td text-right font-mono text-sm text-emerald-700">{fmtMoney(paid)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.balance)}</td>
                  <td className="td"><PaymentStatusBadge status={r.paymentStatus} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/payments?page=${page - 1}${status ? `&status=${status}` : ""}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/payments?page=${page + 1}${status ? `&status=${status}` : ""}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
