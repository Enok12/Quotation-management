import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/utils/format";
import { PaymentStatusBadge, OrderStatusBadge } from "@/components/receipts/status-badges";
import { LinkButton } from "@/components/ui/link-button";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";

interface Props { params: Promise<{ id: string }> }

export default async function CustomerDetailPage({ params }: Props) {
  await requireUser();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      receipts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, receiptNumber: true, date: true,
          totalDue: true, balance: true, paymentStatus: true, orderStatus: true,
        },
      },
    },
  });
  if (!customer) notFound();

  const totalSpend = customer.receipts.reduce((s, r) => s + Number(r.totalDue), 0);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">
      <Link href="/dashboard/customers" className="btn-ghost text-xs mb-6 inline-flex">
        <ArrowLeft size={14} /> Customers
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-ink">{customer.name}</h1>
          <p className="text-stone-500 text-sm mt-1">Customer since {fmtDate(customer.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LinkButton href={`/dashboard/receipts/new?customerId=${customer.id}`} className="btn-primary" icon={<Plus size={15} />}>
            New Receipt
          </LinkButton>
          <DeleteCustomerButton customerId={customer.id} customerName={customer.name} receiptCount={customer.receipts.length} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Info card */}
        <div className="lg:col-span-2 card card-body space-y-4">
          <h2 className="heading-2">Contact Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Phone", value: customer.phone },
              { label: "Email", value: customer.email },
              { label: "NIC", value: customer.nic },
              { label: "Address", value: customer.address },
            ].map((f) => (
              <div key={f.label}>
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{f.label}</span>
                <p className="text-sm text-ink mt-0.5">{f.value ?? "—"}</p>
              </div>
            ))}
          </div>
          {customer.notes && (
            <div>
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Notes</span>
              <p className="text-sm text-stone-600 mt-0.5">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card card-body flex flex-col gap-4">
          <h2 className="heading-2">Summary</h2>
          <div>
            <span className="text-xs text-stone-400 uppercase tracking-wide font-semibold">Total Receipts</span>
            <p className="font-serif text-4xl text-ink mt-0.5">{customer.receipts.length}</p>
          </div>
          <div>
            <span className="text-xs text-stone-400 uppercase tracking-wide font-semibold">Total Value (LKR)</span>
            <p className="font-mono text-lg font-semibold text-ink mt-0.5">{fmtMoney(totalSpend)}</p>
          </div>
        </div>
      </div>

      {/* Receipts table */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-ink">Receipts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left w-20">#</th>
                <th className="th text-left">Date</th>
                <th className="th text-right">Total Due</th>
                <th className="th text-right">Balance</th>
                <th className="th text-left">Payment</th>
                <th className="th text-left">Order</th>
              </tr>
            </thead>
            <tbody>
              {customer.receipts.length === 0 && (
                <tr><td colSpan={6} className="td text-center text-stone-400 py-8">No receipts yet.</td></tr>
              )}
              {customer.receipts.map((r) => (
                <tr key={r.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-mono text-xs text-stone-500">#{r.receiptNumber}</td>
                  <td className="td text-stone-600">{fmtDate(r.date)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.totalDue)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(r.balance)}</td>
                  <td className="td"><PaymentStatusBadge status={r.paymentStatus} /></td>
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={r.orderStatus} />
                      <Link href={`/dashboard/receipts/${r.id}`} className="text-xs text-amber-600 hover:underline">
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
