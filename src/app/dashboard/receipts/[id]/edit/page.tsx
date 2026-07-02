import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReceiptBuilder } from "@/components/receipts/receipt-builder";

interface Props { params: Promise<{ id: string }> }
export const metadata = { title: "Edit Receipt" };

export default async function EditReceiptPage({ params }: Props) {
  await requireUser();
  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      adjustments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!receipt) notFound();

  const customer = {
    id: receipt.customerId,
    name: receipt.custName,
    address: receipt.custAddress,
    phone: receipt.custPhone,
    email: receipt.custEmail,
  };

  const defaultValues = {
    receiptId: id,
    date: receipt.date.toISOString().slice(0, 10),
    notes: receipt.notes ?? undefined,
    paymentMethods: receipt.paymentMethods,
    items: receipt.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
    adjustments: receipt.adjustments.map((a) => ({
      label: a.label,
      amount: Number(a.amount),
    })),
    advanceAmount: Number(receipt.advanceAmount),
    amountPaid: Number(receipt.amountPaid),
    isSample: receipt.orderType === "SAMPLE",
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-stone-200 bg-white flex-none">
        <Link href={`/dashboard/receipts/${id}`} className="btn-ghost text-xs py-1">
          <ArrowLeft size={14} /> Receipt #{receipt.receiptNumber}
        </Link>
        <span className="text-stone-300">|</span>
        <span className="text-sm text-stone-500">
          Editing receipt for <span className="font-semibold text-ink">{receipt.custName}</span>
          {receipt.status === "FINALIZED" && (
            <span className="ml-2 text-xs text-amber-600 font-medium">· This will create a new version</span>
          )}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ReceiptBuilder customer={customer} defaultValues={defaultValues} mode="edit" />
      </div>
    </div>
  );
}
