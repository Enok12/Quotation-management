import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { CustomerSearch } from "@/components/customers/customer-search";
import { FilterTableShell } from "@/components/dashboard/filter-table-shell";
import { ExpensesTable, type ExpenseTotals } from "@/components/receipts/expenses-table";
import { dateRangeFilter, buildQuery } from "@/lib/utils/date-range";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";

interface Props { searchParams: Promise<{ type?: string; page?: string; from?: string; to?: string; search?: string }> }
export const metadata = { title: "Expenses" };

const expenseRecordSelect = {
  fabricExpense: true, patternMakingExpense: true, cuttingExpense: true, productionExpense: true,
  accessoryExpense: true, otherExpense: true, profit: true, finalized: true,
} satisfies Prisma.ExpenseRecordSelect;

const ZERO_TOTALS: ExpenseTotals = {
  bill: 0, quantity: 0, fabric: 0, patternMaking: 0, cutting: 0, production: 0, accessory: 0, other: 0, profit: 0,
};

function rowTotals(r: {
  totalDue: Prisma.Decimal;
  items: { quantity: number }[];
  expenseRecord: { fabricExpense: Prisma.Decimal; patternMakingExpense: Prisma.Decimal; cuttingExpense: Prisma.Decimal; productionExpense: Prisma.Decimal; accessoryExpense: Prisma.Decimal; otherExpense: Prisma.Decimal; profit: Prisma.Decimal } | null;
}): ExpenseTotals {
  const rec = r.expenseRecord;
  const bill = Number(r.totalDue);
  return {
    bill,
    quantity: r.items.reduce((s, i) => s + i.quantity, 0),
    fabric: rec ? Number(rec.fabricExpense) : 0,
    patternMaking: rec ? Number(rec.patternMakingExpense) : 0,
    cutting: rec ? Number(rec.cuttingExpense) : 0,
    production: rec ? Number(rec.productionExpense) : 0,
    accessory: rec ? Number(rec.accessoryExpense) : 0,
    other: rec ? Number(rec.otherExpense) : 0,
    // A receipt with no expense record yet defaults to full bill as profit.
    profit: rec ? Number(rec.profit) : bill,
  };
}

function addTotals(a: ExpenseTotals, b: ExpenseTotals): ExpenseTotals {
  return {
    bill: a.bill + b.bill, quantity: a.quantity + b.quantity,
    fabric: a.fabric + b.fabric, patternMaking: a.patternMaking + b.patternMaking,
    cutting: a.cutting + b.cutting, production: a.production + b.production,
    accessory: a.accessory + b.accessory, other: a.other + b.other, profit: a.profit + b.profit,
  };
}

function subtractTotals(a: ExpenseTotals, b: ExpenseTotals): ExpenseTotals {
  return {
    bill: a.bill - b.bill, quantity: a.quantity - b.quantity,
    fabric: a.fabric - b.fabric, patternMaking: a.patternMaking - b.patternMaking,
    cutting: a.cutting - b.cutting, production: a.production - b.production,
    accessory: a.accessory - b.accessory, other: a.other - b.other, profit: a.profit - b.profit,
  };
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
        items: { select: { quantity: true } },
        expenseRecord: { select: expenseRecordSelect },
      },
    }),
    // Unpaginated, lightweight — used only to total the whole filtered set below.
    prisma.receipt.findMany({
      where: { ...baseWhere, orderType: activeType },
      select: { totalDue: true, items: { select: { quantity: true } }, expenseRecord: { select: expenseRecordSelect } },
    }),
  ]);
  const total = activeType === "BULK" ? bulkCount : sampleCount;
  const totalPages = Math.ceil(total / pageSize);

  // The grand total spans every matching receipt across all pages, but only
  // the current page's rows are ever live-edited client-side without a
  // refresh — so the client component needs the OTHER pages' contribution as
  // a fixed baseline, and adds the current page's rows to it live as they change.
  const grandTotals = allForTotals.reduce((acc, r) => addTotals(acc, rowTotals(r)), ZERO_TOTALS);
  const currentPageTotals = receipts.reduce((acc, r) => addTotals(acc, rowTotals(r)), ZERO_TOTALS);
  const otherPagesTotals = subtractTotals(grandTotals, currentPageTotals);

  const tabs = [
    { label: "Bulk Orders", href: `/dashboard/expenses?${buildQuery({ type: "BULK", from: sp.from, to: sp.to, search: sp.search })}`, active: activeType === "BULK", count: bulkCount },
    { label: "Sample Orders", href: `/dashboard/expenses?${buildQuery({ type: "SAMPLE", from: sp.from, to: sp.to, search: sp.search })}`, active: activeType === "SAMPLE", count: sampleCount },
  ];

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
          <ExpensesTable
            orderType={activeType}
            isAdmin={isAdmin}
            otherPagesTotals={otherPagesTotals}
            rows={receipts.map((r) => ({
              id: r.id,
              receiptNumber: r.receiptNumber as number,
              custName: r.custName,
              date: r.date.toISOString(),
              billAmount: Number(r.totalDue),
              totalQuantity: r.items.reduce((s, i) => s + i.quantity, 0),
              initial: r.expenseRecord
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
                : null,
            }))}
          />
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
