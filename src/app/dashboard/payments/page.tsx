import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { PaymentStatusBadge, OrderTypeBadge } from "@/components/receipts/status-badges";
import { FolderSyncPanel } from "@/components/payments/folder-sync-panel";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";
import { deriveFolder, FOLDER_NAMES, type FolderKey } from "@/lib/order-folder";

interface Props { searchParams: Promise<{ folder?: string; page?: string }> }
export const metadata = { title: "Orders" };

const FOLDERS = ["BULK", "SAMPLE", "COMPLETED"] as const;

// Translate a folder key into a Prisma filter matching deriveFolder().
function whereForFolder(folder?: FolderKey): Prisma.ReceiptWhereInput {
  if (folder === "SAMPLE") return { orderType: "SAMPLE" };
  if (folder === "COMPLETED") return { orderType: "BULK", paymentStatus: "PAID" };
  if (folder === "BULK") return { orderType: "BULK", paymentStatus: { not: "PAID" } };
  return {};
}

export default async function OrdersFolderPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const folder = FOLDERS.includes(sp.folder as (typeof FOLDERS)[number]) ? (sp.folder as FolderKey) : undefined;

  const baseWhere: Prisma.ReceiptWhereInput = { status: "FINALIZED" };
  const where: Prisma.ReceiptWhereInput = { ...baseWhere, ...whereForFolder(folder) };

  const [bulkCount, sampleCount, completedCount, total, receipts, allForSync] = await Promise.all([
    prisma.receipt.count({ where: { ...baseWhere, ...whereForFolder("BULK") } }),
    prisma.receipt.count({ where: { ...baseWhere, ...whereForFolder("SAMPLE") } }),
    prisma.receipt.count({ where: { ...baseWhere, ...whereForFolder("COMPLETED") } }),
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, receiptNumber: true, custName: true, date: true,
        totalDue: true, amountPaid: true, balance: true, paymentStatus: true, orderType: true,
      },
    }),
    // Lightweight list of every receipt for the "Sync all" reconcile.
    prisma.receipt.findMany({
      where: baseWhere,
      select: { id: true, receiptNumber: true, orderType: true, paymentStatus: true },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);
  const allCount = bulkCount + sampleCount + completedCount;

  const syncItems = allForSync.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    folder: deriveFolder(r.orderType, r.paymentStatus),
  }));

  const tabDefs: { label: string; value: FolderKey | null; count: number }[] = [
    { label: "All", value: null, count: allCount },
    { label: FOLDER_NAMES.BULK, value: "BULK", count: bulkCount },
    { label: FOLDER_NAMES.SAMPLE, value: "SAMPLE", count: sampleCount },
    { label: FOLDER_NAMES.COMPLETED, value: "COMPLETED", count: completedCount },
  ];
  const tabItems = tabDefs.map((t) => ({
    label: t.label,
    count: t.count,
    active: (t.value ?? null) === (folder ?? null),
    href: t.value ? `/dashboard/payments?folder=${t.value}` : "/dashboard/payments",
  }));

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Orders</h1>
        <p className="text-stone-500 text-sm mt-1">Bulk Orders · Sample Orders · Completed</p>
      </div>

      {/* Computer-folder sync */}
      <div className="mb-6">
        <FolderSyncPanel items={syncItems} />
      </div>

      {/* Folder tabs + table (loading overlay while switching) */}
      <FilterTableShell groups={[tabItems]}>
      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th text-left w-20">#</th>
              <th className="th text-left">Customer</th>
              <th className="th text-left">Date</th>
              <th className="th text-left">Type</th>
              <th className="th text-right">Total Due</th>
              <th className="th text-right">Paid</th>
              <th className="th text-right">Balance</th>
              <th className="th text-left">Payment</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr><td colSpan={8} className="td text-center text-stone-400 py-10">No orders in this folder.</td></tr>
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
                <td className="td"><OrderTypeBadge type={r.orderType} /></td>
                <td className="td text-right font-mono text-sm">{fmtMoney(r.totalDue)}</td>
                <td className="td text-right font-mono text-sm text-emerald-700">{fmtMoney(r.amountPaid)}</td>
                <td className="td text-right font-mono text-sm">{fmtMoney(r.balance)}</td>
                <td className="td"><PaymentStatusBadge status={r.paymentStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/payments?page=${page - 1}${folder ? `&folder=${folder}` : ""}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/payments?page=${page + 1}${folder ? `&folder=${folder}` : ""}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
      </FilterTableShell>
    </div>
  );
}
