import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import Link from "next/link";
import { Edit } from "lucide-react";
import { Prisma } from "@prisma/client";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { PaymentStatusBadge, OrderTypeBadge } from "@/components/receipts/status-badges";
import { FolderSyncPanel } from "@/components/payments/folder-sync-panel";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomerSearch } from "@/components/customers/customer-search";
import { DeleteReceiptButton } from "@/components/receipts/delete-receipt-button";
import { ExpenseRecordButton } from "@/components/receipts/expense-record-button";
import { TimeTakenBadge } from "@/components/receipts/time-taken-badge";
import { deriveFolder, FOLDER_NAMES, type FolderKey } from "@/lib/order-folder";
import { dateRangeFilter, buildQuery } from "@/lib/utils/date-range";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { receiptNumberLabel } from "@/lib/utils/receipt-number";

interface Props { searchParams: Promise<{ folder?: string; page?: string; from?: string; to?: string; search?: string }> }
export const metadata = { title: "Orders" };

const FOLDERS = ["UNCONFIRMED", "BULK", "SAMPLE", "COMPLETED"] as const;

/**
 * When an order's "Time Taken" clock starts: the moment it was confirmed by
 * money actually arriving, NOT when the receipt was drafted. An order sitting
 * unconfirmed (items entered, no advance paid) hasn't been commissioned yet,
 * so it must not silently accrue days against work nobody has agreed to.
 *
 * Falls back to the receipt date when a receipt carries money but has no
 * Payment rows — that's a bulk-uploaded historical order created already
 * settled (payment rows are only written by recordPayment), so its
 * confirmation effectively happened the day it was entered.
 */
function timeTakenStart(r: { date: Date; amountPaid: Prisma.Decimal; payments: { paidAt: Date }[] }): Date | null {
  if (r.payments.length > 0) return r.payments[0].paidAt;
  return Number(r.amountPaid) > 0 ? r.date : null;
}

// Translate a folder key into a Prisma filter matching deriveFolder().
function whereForFolder(folder?: FolderKey): Prisma.ReceiptWhereInput {
  if (folder === "UNCONFIRMED") return { orderType: "BULK", receiptNumber: null };
  if (folder === "SAMPLE") return { orderType: "SAMPLE" };
  if (folder === "COMPLETED") return { orderType: "BULK", receiptNumber: { not: null }, paymentStatus: "PAID" };
  if (folder === "BULK") return { orderType: "BULK", receiptNumber: { not: null }, paymentStatus: { not: "PAID" } };
  return {};
}

export default async function OrdersFolderPage({ searchParams }: Props) {
  const { role, businessId } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "ORDERS")) return <SectionUnavailable section="Orders" />;
  const isAdmin = role === "ADMIN";
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 25;
  const folder = FOLDERS.includes(sp.folder as (typeof FOLDERS)[number]) ? (sp.folder as FolderKey) : undefined;
  const dateWhere = dateRangeFilter(sp.from, sp.to);
  const search = sp.search?.trim() ?? "";

  // Sync-all always reconciles every receipt, regardless of the date/search filters.
  const baseWhereNoDate: Prisma.ReceiptWhereInput = { businessId, status: "FINALIZED" };
  const baseWhere: Prisma.ReceiptWhereInput = {
    ...baseWhereNoDate,
    ...(dateWhere ? { date: dateWhere } : {}),
    ...(search ? { custName: { contains: search, mode: "insensitive" } } : {}),
  };
  const where: Prisma.ReceiptWhereInput = { ...baseWhere, ...whereForFolder(folder) };

  const [unconfirmedCount, bulkCount, sampleCount, completedCount, total, receipts, allForSync] = await Promise.all([
    prisma.receipt.count({ where: { ...baseWhere, ...whereForFolder("UNCONFIRMED") } }),
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
        expenseRecord: {
          select: {
            fabricExpense: true, patternMakingExpense: true, cuttingExpense: true, productionExpense: true,
            accessoryExpense: true, otherExpense: true, profit: true, finalized: true,
          },
        },
        // Ordered oldest-first: the FIRST payment is what confirms the order
        // and starts the Time Taken clock, and the LAST one is what pushed it
        // to paid-in-full and stopped it. A receipt has only a handful of
        // instalments, so fetching them all is cheaper than two queries.
        payments: { orderBy: { paidAt: "asc" }, select: { paidAt: true } },
      },
    }),
    // Lightweight list of every receipt (confirmed or Unconfirmed) for the
    // "Sync all" reconcile (unfiltered by date/search) — Unconfirmed ones
    // sync a draft into the Unconfirmed folder.
    prisma.receipt.findMany({
      where: baseWhereNoDate,
      select: { id: true, receiptNumber: true, custName: true, orderType: true, paymentStatus: true, category: true },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);
  const allCount = unconfirmedCount + bulkCount + sampleCount + completedCount;

  const syncItems = allForSync.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    custName: r.custName,
    orderType: r.orderType,
    category: r.category,
    folder: deriveFolder(r.orderType, r.paymentStatus, r.receiptNumber),
  }));

  const tabDefs: { label: string; value: FolderKey | null; count: number }[] = [
    { label: "All", value: null, count: allCount },
    { label: FOLDER_NAMES.UNCONFIRMED, value: "UNCONFIRMED", count: unconfirmedCount },
    { label: FOLDER_NAMES.BULK, value: "BULK", count: bulkCount },
    { label: FOLDER_NAMES.SAMPLE, value: "SAMPLE", count: sampleCount },
    { label: FOLDER_NAMES.COMPLETED, value: "COMPLETED", count: completedCount },
  ];
  const tabItems = tabDefs.map((t) => ({
    label: t.label,
    count: t.count,
    active: (t.value ?? null) === (folder ?? null),
    href: `/dashboard/payments?${buildQuery({ folder: t.value ?? undefined, from: sp.from, to: sp.to, search: sp.search })}`,
  }));

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">Orders</h1>
        <p className="text-stone-500 text-sm mt-1">Unconfirmed · Bulk Orders · Sample Orders · Completed</p>
      </div>

      {/* Computer-folder sync */}
      <div className="mb-6">
        <FolderSyncPanel items={syncItems} />
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <CustomerSearch defaultValue={search} placeholder="Search by customer name…" />
        <DateRangeFilter />
      </div>

      {/* Folder tabs + table (loading overlay while switching) */}
      <FilterTableShell groups={[tabItems]}>
      <div className="card">
        <div className="overflow-x-auto">
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
                <th className="th text-left">Time Taken</th>
                <th className="th text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && (
                <tr><td colSpan={10} className="td text-center text-stone-400 py-10">No orders in this folder.</td></tr>
              )}
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-mono text-xs text-stone-500">
                    {r.receiptNumber !== null
                      ? receiptNumberLabel(r.receiptNumber, r.orderType)
                      : <span className="text-amber-600">Unconfirmed</span>}
                  </td>
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
                  <td className="td">
                    <TimeTakenBadge
                      startDate={timeTakenStart(r)}
                      completedAt={
                        r.paymentStatus === "PAID"
                          ? (r.payments[r.payments.length - 1]?.paidAt ?? r.date)
                          : null
                      }
                    />
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/dashboard/receipts/${r.id}/edit`}
                        title="Edit receipt"
                        aria-label="Edit receipt"
                        className="text-stone-300 hover:text-amber-600 dark:text-stone-600 dark:hover:text-amber-400 transition-colors p-1"
                      >
                        <Edit size={14} />
                      </Link>
                      {/* No expenses to log against an order that isn't confirmed yet. */}
                      {r.receiptNumber !== null && (
                        <ExpenseRecordButton
                          receiptId={r.id}
                          receiptNumber={r.receiptNumber}
                          billAmount={Number(r.totalDue)}
                          initial={
                            r.expenseRecord
                              ? {
                                  fabricExpense: Number(r.expenseRecord.fabricExpense),
                                  patternMakingExpense: Number(r.expenseRecord.patternMakingExpense),
                                  cuttingExpense: Number(r.expenseRecord.cuttingExpense),
                                  productionExpense: Number(r.expenseRecord.productionExpense),
                                  accessoryExpense: Number(r.expenseRecord.accessoryExpense),
                                  otherExpense: Number(r.expenseRecord.otherExpense),
                                  profit: Number(r.expenseRecord.profit),
                                  finalized: r.expenseRecord.finalized,
                                }
                              : null
                          }
                          isAdmin={isAdmin}
                          orderType={r.orderType}
                        />
                      )}
                      <DeleteReceiptButton receiptId={r.id} receiptNumber={r.receiptNumber} orderType={r.orderType} iconOnly />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/payments?${buildQuery({ page: String(page - 1), folder, from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/payments?${buildQuery({ page: String(page + 1), folder, from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
      </FilterTableShell>
    </div>
  );
}
