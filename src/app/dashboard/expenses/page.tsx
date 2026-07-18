import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { fmtMoney } from "@/lib/utils/format";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomerSearch } from "@/components/customers/customer-search";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";
import { ExpenseRow } from "@/components/receipts/expense-row";
import { dateRangeFilter, buildQuery } from "@/lib/utils/date-range";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";

interface Props { searchParams: Promise<{ type?: string; page?: string; from?: string; to?: string; search?: string }> }
export const metadata = { title: "Expenses" };

const expenseRecordSelect = {
  fabricExpense: true, patternMakingExpense: true, cuttingExpense: true, productionExpense: true,
  accessoryExpense: true, otherExpense: true, profit: true, finalized: true,
} satisfies Prisma.ExpenseRecordSelect;

// Mirrors the exact box model (width/padding/border) of the editable cost
// cells in each row (see ExpenseRow's cellInput) — a plain text node here
// would sit at a different inset than an <input>'s own internal padding, so
// the Total row's digits wouldn't line up with the values above it.
// pointer-events-none (plus tabIndex=-1) keeps it inert: a readOnly input is
// still focusable/clickable by default, which would otherwise pick up the
// site-wide focus ring and text-selection highlight on click, looking like
// an editable field it isn't.
function totalCell(value: number) {
  return (
    <input
      type="text" readOnly tabIndex={-1} value={fmtMoney(value)}
      className="w-24 px-2 py-1 text-xs text-right bg-transparent border border-transparent rounded outline-none pointer-events-none select-none"
    />
  );
}

const ORDER_TYPES = ["BULK", "SAMPLE"] as const;
type OrderType = (typeof ORDER_TYPES)[number];

export default async function ExpensesPage({ searchParams }: Props) {
  const { role, businessId } = await requireBusiness();
  const access = await getBusinessAccess(businessId);
  if (!hasSection(access, "EXPENSES")) return <SectionUnavailable section="Expenses" />;
  const isAdmin = role === "ADMIN";
  const sp = await searchParams;
  const activeType: OrderType = ORDER_TYPES.includes(sp.type as OrderType) ? (sp.type as OrderType) : "BULK";
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 30;
  const dateWhere = dateRangeFilter(sp.from, sp.to);
  const search = sp.search?.trim() ?? "";

  const baseWhere: Prisma.ReceiptWhereInput = {
    businessId,
    status: "FINALIZED",
    // Unconfirmed bulk orders (no advance paid yet) don't belong here —
    // nothing to log costs against until the order is confirmed. Sample
    // orders always have a receiptNumber already, so this has no effect on them.
    receiptNumber: { not: null },
    ...(dateWhere ? { date: dateWhere } : {}),
    ...(search ? { custName: { contains: search, mode: "insensitive" } } : {}),
  };

  const [bulkCount, sampleCount, receipts, allForTotals] = await Promise.all([
    prisma.receipt.count({ where: { ...baseWhere, orderType: "BULK" } }),
    prisma.receipt.count({ where: { ...baseWhere, orderType: "SAMPLE" } }),
    prisma.receipt.findMany({
      where: { ...baseWhere, orderType: activeType },
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
      where: { ...baseWhere, orderType: activeType },
      select: { totalDue: true, expenseRecord: { select: expenseRecordSelect } },
    }),
  ]);
  const total = activeType === "BULK" ? bulkCount : sampleCount;
  const totalPages = Math.ceil(total / pageSize);

  const totals = allForTotals.reduce(
    (acc, r) => {
      const rec = r.expenseRecord;
      const bill = Number(r.totalDue);
      acc.bill += bill;
      acc.fabric += rec ? Number(rec.fabricExpense) : 0;
      acc.patternMaking += rec ? Number(rec.patternMakingExpense) : 0;
      acc.cutting += rec ? Number(rec.cuttingExpense) : 0;
      acc.production += rec ? Number(rec.productionExpense) : 0;
      acc.accessory += rec ? Number(rec.accessoryExpense) : 0;
      acc.other += rec ? Number(rec.otherExpense) : 0;
      // A receipt with no expense record yet defaults to full bill as profit.
      acc.profit += rec ? Number(rec.profit) : bill;
      return acc;
    },
    { bill: 0, fabric: 0, patternMaking: 0, cutting: 0, production: 0, accessory: 0, other: 0, profit: 0 },
  );

  const tabs = [
    { label: "Bulk Orders", href: `/dashboard/expenses?${buildQuery({ type: "BULK", from: sp.from, to: sp.to, search: sp.search })}`, active: activeType === "BULK", count: bulkCount },
    { label: "Sample Orders", href: `/dashboard/expenses?${buildQuery({ type: "SAMPLE", from: sp.from, to: sp.to, search: sp.search })}`, active: activeType === "SAMPLE", count: sampleCount },
  ];
  const colSpan = activeType === "BULK" ? 9 : 6;

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      {/* No max-width here (unlike other list pages) — this table has more
          columns than any other page in the app, so on wide monitors it
          should use the extra space to show every column at once, instead
          of scrolling unnecessarily inside an artificially narrow card. */}
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

      <FilterTableShell groups={[tabs]}>
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th text-left">Date</th>
                  <th className="th text-left">Receipt</th>
                  <th className="th text-right">Bill Amount</th>
                  <th className="th text-right">Fabric Cost</th>
                  <th className="th text-right">Pattern Making Cost</th>
                  {activeType === "BULK" && <th className="th text-right">Cutting Cost</th>}
                  <th className="th text-right">Production Cost</th>
                  {activeType === "BULK" && <th className="th text-right">Accessories Cost</th>}
                  {activeType === "BULK" && <th className="th text-right">Other</th>}
                  <th className="th text-right sticky right-20 z-20 w-28 border-l border-stone-200 dark:border-stone-700">Profit</th>
                  <th className="th text-center sticky right-0 z-20 w-20">Finalize</th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 && (
                  <tr><td colSpan={colSpan} className="td text-center text-stone-400 py-10">No orders found.</td></tr>
                )}
                {receipts.map((r) => (
                  <ExpenseRow
                    key={r.id}
                    receiptId={r.id}
                    receiptNumber={r.receiptNumber as number}
                    custName={r.custName}
                    date={r.date}
                    billAmount={Number(r.totalDue)}
                    orderType={activeType}
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
                  />
                ))}
              </tbody>
              {receipts.length > 0 && (
                <tfoot>
                  <tr className="bg-stone-25 dark:bg-white/[0.02] font-semibold">
                    <td colSpan={2} className="td text-right text-ink">Total</td>
                    <td className="td text-right font-mono">{fmtMoney(totals.bill)}</td>
                    <td className="td text-right">{totalCell(totals.fabric)}</td>
                    <td className="td text-right">{totalCell(totals.patternMaking)}</td>
                    {activeType === "BULK" && <td className="td text-right">{totalCell(totals.cutting)}</td>}
                    <td className="td text-right">{totalCell(totals.production)}</td>
                    {activeType === "BULK" && <td className="td text-right">{totalCell(totals.accessory)}</td>}
                    {activeType === "BULK" && <td className="td text-right">{totalCell(totals.other)}</td>}
                    <td className="td text-right sticky right-20 z-10 w-28 border-l border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">{totalCell(totals.profit)}</td>
                    <td className="td sticky right-0 z-10 w-20 bg-stone-50 dark:bg-stone-800" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex items-center justify-between text-sm">
              <span className="text-stone-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={`/dashboard/expenses?${buildQuery({ type: activeType, page: String(page - 1), from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Previous</Link>}
                {page < totalPages && <Link href={`/dashboard/expenses?${buildQuery({ type: activeType, page: String(page + 1), from: sp.from, to: sp.to, search: sp.search })}`} className="btn-outline text-xs py-1.5">Next</Link>}
              </div>
            </div>
          )}
        </div>
      </FilterTableShell>
    </div>
  );
}
