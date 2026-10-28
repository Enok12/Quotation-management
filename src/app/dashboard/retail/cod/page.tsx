import Link from "next/link";
import type { CodStatus } from "@prisma/client";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { codService } from "@/server/services/cod.service";
import { fmtMoney } from "@/lib/utils/format";
import { CodOrdersTable, type CodOrderRow } from "@/components/cod/cod-orders-table";
import { BusinessCodForm } from "@/components/settings/business-cod-form";

interface Props { searchParams: Promise<{ tab?: string; q?: string; page?: string }> }
export const metadata = { title: "COD Orders" };

// Tabs group the seven statuses into the steps a one-person shop actually works through.
const TABS: { key: string; label: string; statuses: CodStatus[] }[] = [
  { key: "open", label: "Open", statuses: ["PENDING_CONFIRMATION", "PENDING_DISPATCH", "OUT_FOR_DELIVERY"] },
  { key: "confirm", label: "Awaiting confirmation", statuses: ["PENDING_CONFIRMATION"] },
  { key: "dispatch", label: "Ready to dispatch", statuses: ["PENDING_DISPATCH"] },
  { key: "out", label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"] },
  { key: "receivable", label: "Awaiting courier payout", statuses: ["DELIVERED"] },
  { key: "settled", label: "Settled", statuses: ["REMITTED"] },
  { key: "closed", label: "Refused / cancelled", statuses: ["REFUSED", "CANCELLED"] },
];

export default async function CodOrdersPage({ searchParams }: Props) {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "SALES")) return <SectionUnavailable section="Sales" />;

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId }, select: { name: true, codEnabled: true, codRefusalWarnThreshold: true },
  });
  if (!business.codEnabled) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-3xl">
        <h1 className="font-serif text-3xl text-ink">COD Orders</h1>
        <p className="text-stone-500 text-sm mt-2">
          Cash on Delivery isn&apos;t turned on for this business.{" "}
          {role === "ADMIN" ? <>Switch it on from the <Link href="/dashboard/retail/sales" className="underline">Sales page</Link>.</> : "Ask an administrator to switch it on from the Sales page."}
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(Number.parseInt(sp.page ?? "1", 10) || 1, 1);

  const [{ rows, total, pageSize, refusalByPhone }, counts, summary] = await Promise.all([
    codService.list(businessId, { status: tab.statuses, search: sp.q, page }),
    codService.statusCounts(businessId),
    codService.summary(businessId),
  ]);

  const orders: CodOrderRow[] = rows.map((r) => ({
    saleId: r.saleId, dispatchRef: r.dispatchRef, status: r.status,
    customerName: r.customerName, customerPhone: r.customerPhone, deliveryAddress: r.deliveryAddress,
    courierName: r.courierName, waybillNo: r.waybillNo,
    codAmount: Number(r.codAmount), deliveryFee: Number(r.deliveryFee), feePaidBy: r.feePaidBy,
    createdAt: r.createdAt.toISOString(),
    earlierRefusals: refusalByPhone.get(r.customerPhoneNormalized) ?? 0,
    confirmToken: r.status === "PENDING_CONFIRMATION" ? r.confirmToken : null,
    confirmExpired: r.status === "PENDING_CONFIRMATION" && !!r.confirmExpiresAt && r.confirmExpiresAt.getTime() <= Date.now(),
    items: r.sale.items.map((i) => `${i.quantity} × ${i.product.name}`).join(", "),
    closedReason: r.closedReason,
  }));

  const countFor = (statuses: CodStatus[]) => statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-ink">COD Orders</h1>
        <p className="text-stone-500 text-sm mt-1">Cash-on-delivery parcels, from confirmation to courier payout</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Awaiting courier payout</span>
          <div className="font-serif text-3xl text-ink mt-2">{fmtMoney(summary.receivable)}</div>
          <span className="text-xs text-stone-400">{summary.receivableCount} orders (after courier fees)</span>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Older than 14 days</span>
          <div className={`font-serif text-3xl mt-2 ${summary.ageBuckets["15+"] > 0 ? "text-red-600 dark:text-red-400" : "text-ink"}`}>
            {fmtMoney(summary.ageBuckets["15+"])}
          </div>
          <span className="text-xs text-stone-400">chase these couriers</span>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Open orders</span>
          <div className="font-serif text-3xl text-ink mt-2">{countFor(TABS[0].statuses)}</div>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">Refusal rate</span>
          <div className="font-serif text-3xl text-ink mt-2">{(summary.refusalRate * 100).toFixed(0)}%</div>
          <span className="text-xs text-stone-400">of finished orders</span>
        </div>
      </div>

      <CodOrdersTable
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: countFor(t.statuses) }))}
        orders={orders}
        total={total}
        page={page}
        pageSize={pageSize}
        tabKey={tab.key}
        search={sp.q ?? ""}
        businessName={business.name}
        isAdmin={role === "ADMIN"}
        refusalThreshold={business.codRefusalWarnThreshold}
        canSettle={tab.key === "receivable"}
      />

      {role === "ADMIN" && (
        <details className="card card-body mt-8">
          <summary className="cursor-pointer text-sm font-medium text-ink">COD settings</summary>
          <div className="mt-4">
            <BusinessCodForm initialEnabled={business.codEnabled} initialThreshold={business.codRefusalWarnThreshold} />
          </div>
        </details>
      )}
    </div>
  );
}
