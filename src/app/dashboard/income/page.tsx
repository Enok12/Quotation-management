import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { PrintButton } from "@/components/income/print-button";
import { dateRangeFilter } from "@/lib/utils/date-range";

interface Props { searchParams: Promise<{ from?: string; to?: string }> }
export const metadata = { title: "Income" };

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export default async function IncomePage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;

  // Default to "this month" on first visit so the report always opens with
  // a sensible period instead of an empty picker.
  if (!sp.from && !sp.to) {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    redirect(`/dashboard/income?from=${toISODate(firstOfMonth)}&to=${toISODate(now)}`);
  }

  const dateWhere = dateRangeFilter(sp.from, sp.to);

  const receipts = await prisma.receipt.findMany({
    where: { status: "FINALIZED", ...(dateWhere ? { date: dateWhere } : {}) },
    orderBy: { date: "asc" },
    select: {
      id: true, receiptNumber: true, custName: true, date: true, orderType: true, totalDue: true,
      expenses: { select: { amount: true } },
    },
  });

  const rows = receipts.map((r) => {
    const expenseTotal = r.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return {
      id: r.id,
      receiptNumber: r.receiptNumber,
      custName: r.custName,
      date: r.date,
      orderType: r.orderType,
      revenue: Number(r.totalDue),
      expenseTotal,
      profit: Number(r.totalDue) - expenseTotal,
    };
  });

  const bulkCount = rows.filter((r) => r.orderType === "BULK").length;
  const sampleCount = rows.filter((r) => r.orderType === "SAMPLE").length;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenseTotal, 0);
  const profit = totalRevenue - totalExpenses;
  const profitClass = profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Screen-only controls */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="font-serif text-3xl text-ink">Income</h1>
          <p className="text-stone-500 text-sm mt-1">Profit &amp; loss for a date range</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter />
          <PrintButton />
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="font-serif text-2xl text-ink">MONTRA — Profit &amp; Loss Statement</h1>
        <p className="text-stone-500 text-sm mt-1">
          {sp.from ? fmtDate(sp.from) : ""} – {sp.to ? fmtDate(sp.to) : ""}
        </p>
      </div>

      <p className="text-sm text-stone-500 mb-4 print:hidden">
        Period: {sp.from ? fmtDate(sp.from) : "—"} – {sp.to ? fmtDate(sp.to) : "—"}
      </p>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Orders</span>
          <div className="font-serif text-3xl text-ink mt-2">{rows.length}</div>
          <p className="text-xs text-stone-400 mt-1">{bulkCount} bulk · {sampleCount} sample</p>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Revenue</span>
          <div className="font-serif text-3xl text-ink mt-2">{fmtMoney(totalRevenue)}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Expenses</span>
          <div className="font-serif text-3xl text-red-600 dark:text-red-400 mt-2">{fmtMoney(totalExpenses)}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Net Profit</span>
          <div className={`font-serif text-3xl mt-2 ${profitClass}`}>{fmtMoney(profit)}</div>
        </div>
      </div>

      {/* Detail */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-ink">Orders in this period</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Date</th>
                <th className="th text-left">Receipt</th>
                <th className="th text-left">Customer</th>
                <th className="th text-left">Type</th>
                <th className="th text-right">Revenue</th>
                <th className="th text-right">Expenses</th>
                <th className="th text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-stone-400 py-10">No orders in this period.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td text-stone-500 text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="td font-mono text-xs text-stone-500">#{r.receiptNumber}</td>
                  <td className="td text-sm">{r.custName}</td>
                  <td className="td text-xs text-stone-500">{r.orderType === "BULK" ? "Bulk" : "Sample"}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.revenue)}</td>
                  <td className="td text-right font-mono text-sm text-red-600 dark:text-red-400">{fmtMoney(r.expenseTotal)}</td>
                  <td className={`td text-right font-mono text-sm font-semibold ${r.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fmtMoney(r.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-stone-25 dark:bg-white/[0.02] font-semibold">
                  <td colSpan={4} className="td text-right text-ink">Total</td>
                  <td className="td text-right font-mono">{fmtMoney(totalRevenue)}</td>
                  <td className="td text-right font-mono text-red-600 dark:text-red-400">{fmtMoney(totalExpenses)}</td>
                  <td className={`td text-right font-mono ${profitClass}`}>{fmtMoney(profit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
