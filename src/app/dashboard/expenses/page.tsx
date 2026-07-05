import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { fmtMoney } from "@/lib/utils/format";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomerSearch } from "@/components/customers/customer-search";
import { ExpenseRow } from "@/components/receipts/expense-row";
import { dateRangeFilter, buildQuery } from "@/lib/utils/date-range";

interface Props { searchParams: Promise<{ page?: string; from?: string; to?: string; search?: string }> }
export const metadata = { title: "Expenses" };

const expenseRecordSelect = {
  fabricExpense: true, sewingExpense: true, accessoryExpense: true, otherExpense: true,
  profit: true, finalized: true,
} satisfies Prisma.ExpenseRecordSelect;

export default async function ExpensesPage({ searchParams }: Props) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 30;
  const dateWhere = dateRangeFilter(sp.from, sp.to);
  const search = sp.search?.trim() ?? "";

  // Every receipt (bulk or sample) is eligible for expense tracking.
  const where: Prisma.ReceiptWhereInput = {
    status: "FINALIZED",
    ...(dateWhere ? { date: dateWhere } : {}),
    ...(search ? { custName: { contains: search, mode: "insensitive" } } : {}),
  };

  const [total, receipts, allForTotals] = await Promise.all([
    prisma.receipt.count({ where }),
    prisma.receipt.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, receiptNumber: true, custName: true, date: true, totalDue: true,
        expenseRecord: { select: expenseRecordSelect },
      },
    }),
    // Unpaginated, lightweight — used only to total the whole filtered set below.
    prisma.receipt.findMany({
      where,
      select: { totalDue: true, expenseRecord: { select: expenseRecordSelect } },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  const totals = allForTotals.reduce(
    (acc, r) => {
      const rec = r.expenseRecord;
      const bill = Number(r.totalDue);
      acc.bill += bill;
      acc.fabric += rec ? Number(rec.fabricExpense) : 0;
      acc.sewing += rec ? Number(rec.sewingExpense) : 0;
      acc.accessory += rec ? Number(rec.accessoryExpense) : 0;
      acc.other += rec ? Number(rec.otherExpense) : 0;
      // A receipt with no expense record yet defaults to full bill as profit.
      acc.profit += rec ? Number(rec.profit) : bill;
      return acc;
    },
    { bill: 0, fabric: 0, sewing: 0, accessory: 0, other: 0, profit: 0 },
  );

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">Expenses</h1>
          <p className="text-stone-500 text-sm mt-1">
            {total.toLocaleString()} order{total === 1 ? "" : "s"} · Finalize a row to include it in Income
          </p>
        </div>
        <DateRangeFilter />
      </div>

      <div className="mb-4">
        <CustomerSearch defaultValue={search} placeholder="Search by receipt number or customer name…" />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Date</th>
                <th className="th text-left">Receipt</th>
                <th className="th text-right">Bill Amount</th>
                <th className="th text-right">Fabric</th>
                <th className="th text-right">Sewing</th>
                <th className="th text-right">Accessory</th>
                <th className="th text-right">Other</th>
                <th className="th text-right">Profit</th>
                <th className="th text-center w-20">Finalize</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && (
                <tr><td colSpan={9} className="td text-center text-stone-400 py-10">No orders found.</td></tr>
              )}
              {receipts.map((r) => (
                <ExpenseRow
                  key={r.id}
                  receiptId={r.id}
                  receiptNumber={r.receiptNumber}
                  custName={r.custName}
                  date={r.date}
                  billAmount={Number(r.totalDue)}
                  initial={
                    r.expenseRecord
                      ? {
                          fabricExpense: Number(r.expenseRecord.fabricExpense),
                          sewingExpense: Number(r.expenseRecord.sewingExpense),
                          accessoryExpense: Number(r.expenseRecord.accessoryExpense),
                          otherExpense: Number(r.expenseRecord.otherExpense),
                          profit: Number(r.expenseRecord.profit),
                          finalized: r.expenseRecord.finalized,
                        }
                      : null
                  }
                  isAdmin={isAdmin}
                />
              ))}
            </tbody>
            {receipts.length > 0 && (
              <tfoot>
                <tr className="bg-stone-25 dark:bg-white/[0.02] font-semibold">
                  <td colSpan={2} className="td text-right text-ink">Total</td>
                  <td className="td text-right font-mono">{fmtMoney(totals.bill)}</td>
                  <td className="td text-right font-mono">{fmtMoney(totals.fabric)}</td>
                  <td className="td text-right font-mono">{fmtMoney(totals.sewing)}</td>
                  <td className="td text-right font-mono">{fmtMoney(totals.accessory)}</td>
                  <td className="td text-right font-mono">{fmtMoney(totals.other)}</td>
                  <td className="td text-right font-mono">{fmtMoney(totals.profit)}</td>
                  <td className="td" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
            <span className="text-stone-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={`/dashboard/expenses?${buildQuery({ page: String(page - 1), from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Previous</Link>}
              {page < totalPages && <Link href={`/dashboard/expenses?${buildQuery({ page: String(page + 1), from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Next</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
