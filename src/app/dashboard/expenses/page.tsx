import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { fmtMoney, fmtDate } from "@/lib/utils/format";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomerSearch } from "@/components/customers/customer-search";
import { dateRangeFilter, buildQuery } from "@/lib/utils/date-range";

interface Props { searchParams: Promise<{ page?: string; from?: string; to?: string; search?: string }> }
export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 30;
  const dateWhere = dateRangeFilter(sp.from, sp.to);
  const search = sp.search?.trim() ?? "";

  // Search by exact receipt number when the query is numeric, otherwise by
  // customer name — covers "I know the receipt #" and "I know the customer".
  let receiptFilter: Prisma.ExpenseWhereInput = {};
  if (search) {
    const asNumber = Number(search);
    receiptFilter = Number.isInteger(asNumber) && asNumber > 0
      ? { receipt: { receiptNumber: asNumber } }
      : { receipt: { custName: { contains: search, mode: "insensitive" } } };
  }
  const where: Prisma.ExpenseWhereInput = {
    ...(dateWhere ? { createdAt: dateWhere } : {}),
    ...receiptFilter,
  };

  const [total, totalAmount, expenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, description: true, amount: true, createdAt: true,
        receipt: { select: { id: true, receiptNumber: true, custName: true } },
        recordedBy: { select: { name: true, email: true } },
      },
    }),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">Expenses</h1>
          <p className="text-stone-500 text-sm mt-1">
            {total.toLocaleString()} expense{total === 1 ? "" : "s"}
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
                <th className="th text-left">Description</th>
                <th className="th text-left">Recorded By</th>
                <th className="th text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr><td colSpan={5} className="td text-center text-stone-400 py-10">No expenses found.</td></tr>
              )}
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td text-stone-500 text-xs whitespace-nowrap">{fmtDate(exp.createdAt)}</td>
                  <td className="td">
                    <Link href={`/dashboard/receipts/${exp.receipt.id}`} className="text-xs hover:text-amber-600 transition-colors">
                      <span className="font-mono text-stone-500">#{exp.receipt.receiptNumber}</span>
                      <span className="text-stone-400"> · {exp.receipt.custName}</span>
                    </Link>
                  </td>
                  <td className="td text-sm">{exp.description}</td>
                  <td className="td text-xs text-stone-500">{exp.recordedBy.name ?? exp.recordedBy.email}</td>
                  <td className="td text-right font-mono text-sm text-red-600 dark:text-red-400">{fmtMoney(exp.amount)}</td>
                </tr>
              ))}
            </tbody>
            {search && expenses.length > 0 && (
              <tfoot>
                <tr className="bg-stone-25 dark:bg-white/[0.02]">
                  <td colSpan={4} className="td text-right font-semibold text-ink">
                    Total Expense
                  </td>
                  <td className="td text-right font-mono font-semibold text-red-600 dark:text-red-400">
                    {fmtMoney(totalAmount._sum.amount ?? 0)}
                  </td>
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
