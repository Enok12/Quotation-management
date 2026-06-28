import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, FileDown } from "lucide-react";
import { fmtMoney, fmtDate, fmtDateTime } from "@/lib/utils/format";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/receipts/status-badges";
import { GeneratePdfButton } from "@/components/receipts/generate-pdf-button";
import { OrderStatusChanger } from "@/components/receipts/order-status-changer";
import { RecordPaymentButton } from "@/components/receipts/record-payment-button";
import { VersionHistory } from "@/components/receipts/version-history";

interface Props { params: Promise<{ id: string }> }
export const metadata = { title: "Receipt" };

export default async function ReceiptDetailPage({ params }: Props) {
  await requireUser();
  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      adjustments: { orderBy: { sortOrder: "asc" } },
      versions: { orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true, changeSummary: true, createdAt: true } },
      orderHistory: { orderBy: { createdAt: "desc" }, take: 5, select: { toStatus: true, fromStatus: true, note: true, createdAt: true } },
      payments: { orderBy: { paidAt: "desc" }, select: { id: true, amount: true, method: true, note: true, paidAt: true } },
    },
  });
  if (!receipt) notFound();

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/receipts" className="btn-ghost text-xs">
          <ArrowLeft size={14} /> Receipts
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl text-ink">Receipt #{receipt.receiptNumber}</h1>
            <OrderStatusBadge status={receipt.orderStatus} />
            <PaymentStatusBadge status={receipt.paymentStatus} />
          </div>
          <p className="text-stone-500 text-sm mt-1">{receipt.custName} · {fmtDate(receipt.date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {receipt.paymentStatus !== "PAID" && (
            <RecordPaymentButton
              receiptId={id}
              receiptNumber={receipt.receiptNumber}
              balance={Number(receipt.balance)}
              advanceAmount={Number(receipt.advanceAmount)}
              amountPaid={Number(receipt.amountPaid)}
            />
          )}
          <GeneratePdfButton receiptId={id} receiptNumber={receipt.receiptNumber} />
          <Link href={`/dashboard/receipts/${id}/edit`} className="btn-outline">
            <Edit size={14} /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-6">
          {/* Customer + Payment */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-ink">Customer Details</h2></div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div className="space-y-3">
                {[
                  { label: "Name", value: receipt.custName },
                  { label: "Address", value: receipt.custAddress },
                  { label: "Phone", value: receipt.custPhone },
                  { label: "Email", value: receipt.custEmail },
                ].map((f) => (
                  <div key={f.label}>
                    <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{f.label}</span>
                    <p className="text-sm text-ink mt-0.5">{f.value ?? "—"}</p>
                  </div>
                ))}
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Payment Method</span>
                <div className="mt-1 space-y-1">
                  {receipt.paymentMethods.length === 0
                    ? <p className="text-sm text-stone-400">—</p>
                    : receipt.paymentMethods.map((m) => (
                        <span key={m} className="block text-sm text-ink capitalize">{m.replace("_", " ")}</span>
                      ))}
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <div className="card-header"><h2 className="text-sm font-semibold text-ink">Items</h2></div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th text-center w-16">Qty</th>
                  <th className="th text-left">Description</th>
                  <th className="th text-right">Unit Price</th>
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item) => (
                  <tr key={item.id}>
                    <td className="td text-center font-mono">{item.quantity}</td>
                    <td className="td">{item.description}</td>
                    <td className="td text-right font-mono">{fmtMoney(item.unitPrice)}</td>
                    <td className="td text-right font-mono font-semibold">{fmtMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Totals block */}
            <div className="border-t border-stone-100">
              {receipt.adjustments.map((a) => (
                <div key={a.id} className="flex justify-between px-4 py-2 text-sm border-b border-stone-50">
                  <span className="font-medium text-stone-600">{a.label}</span>
                  <span className="font-mono">{fmtMoney(a.amount)}</span>
                </div>
              ))}
              {[
                { label: "Total Due", value: receipt.totalDue, bold: true },
                { label: "Advance Payment", value: receipt.advanceAmount },
                { label: "Amount Paid", value: receipt.amountPaid },
                { label: "Balance", value: receipt.balance, bold: true },
              ].map(({ label, value, bold }) => (
                <div key={label} className={cn("flex justify-between px-4 py-2 text-sm border-b border-stone-50", bold && "bg-amber-50")}>
                  <span className={cn("text-stone-600", bold && "font-semibold text-ink")}>{label}</span>
                  <span className={cn("font-mono", bold && "font-semibold")}>{fmtMoney(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Order status */}
          {receipt.status === "FINALIZED" && (
            <div className="card card-body">
              <h2 className="heading-2 mb-3">Order Status</h2>
              <OrderStatusChanger
                receiptId={id}
                currentStatus={receipt.orderStatus}
              />
            </div>
          )}

          {/* Payment history */}
          {receipt.status === "FINALIZED" && (
            <div className="card card-body">
              <div className="flex items-center justify-between mb-3">
                <h2 className="heading-2">Payment History</h2>
                <PaymentStatusBadge status={receipt.paymentStatus} />
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-stone-500">Paid / Total</span>
                <span className="font-mono">
                  {fmtMoney(receipt.amountPaid)} / {fmtMoney(receipt.totalDue)}
                </span>
              </div>
              {receipt.payments.length === 0 ? (
                <p className="text-sm text-stone-400">No payments recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {receipt.payments.map((pmt) => (
                    <li key={pmt.id} className="flex items-start justify-between text-sm border-t border-stone-50 pt-2">
                      <div>
                        <span className="font-mono text-emerald-700">{fmtMoney(pmt.amount)}</span>
                        {pmt.method && <span className="text-stone-400 text-xs ml-2">{pmt.method.replace("_", " ")}</span>}
                        {pmt.note && <p className="text-xs text-stone-400 mt-0.5">{pmt.note}</p>}
                      </div>
                      <span className="text-xs text-stone-400 whitespace-nowrap">{fmtDate(pmt.paidAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="card card-body space-y-3">
            <h2 className="heading-2">Details</h2>
            <div>
              <span className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Created</span>
              <p className="text-sm text-ink mt-0.5">{fmtDateTime(receipt.createdAt)}</p>
            </div>
            {receipt.finalizedAt && (
              <div>
                <span className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Finalized</span>
                <p className="text-sm text-ink mt-0.5">{fmtDateTime(receipt.finalizedAt)}</p>
              </div>
            )}
            {receipt.notes && (
              <div>
                <span className="text-xs text-stone-400 font-semibold uppercase tracking-wide">Notes</span>
                <p className="text-sm text-stone-600 mt-0.5">{receipt.notes}</p>
              </div>
            )}
          </div>

          {/* Version history */}
          {receipt.versions.length > 0 && (
            <div className="card card-body">
              <VersionHistory versions={receipt.versions} receiptId={id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
