import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReceiptBuilder } from "@/components/receipts/receipt-builder";
import { receiptNumberLabelOr } from "@/lib/utils/receipt-number";

interface Props { params: Promise<{ id: string }> }
export const metadata = { title: "Edit Receipt" };

export default async function EditReceiptPage({ params }: Props) {
  const { businessId } = await requireBusiness();
  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({
    where: { id, businessId },
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
      itemId: i.id,
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
    category: receipt.category,
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-6 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex-none flex-wrap">
        <Link href={`/dashboard/receipts/${id}`} className="btn-ghost text-xs py-1">
          <ArrowLeft size={14} /> Receipt {receiptNumberLabelOr(receipt.receiptNumber, receipt.orderType)}
        </Link>
        <span className="text-stone-300 hidden sm:inline">|</span>
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
