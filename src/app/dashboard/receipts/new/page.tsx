import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReceiptBuilder } from "@/components/receipts/receipt-builder";
import { CustomerPickerShell } from "@/components/receipts/customer-picker-shell";

interface Props { searchParams: Promise<{ customerId?: string }> }

export const metadata = { title: "New Receipt" };

export default async function NewReceiptPage({ searchParams }: Props) {
  await requireUser();
  const { customerId } = await searchParams;

  if (!customerId) {
    // Show customer picker first
    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, email: true },
    });
    return <CustomerPickerShell customers={customers} />;
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, address: true, phone: true, email: true },
  });
  if (!customer) notFound();

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-6 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex-none flex-wrap">
        <Link href="/dashboard/receipts" className="btn-ghost text-xs py-1">
          <ArrowLeft size={14} /> Receipts
        </Link>
        <span className="text-stone-300 hidden sm:inline">|</span>
        <span className="text-sm text-stone-500">New receipt for <span className="font-semibold text-ink">{customer.name}</span></span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ReceiptBuilder customer={customer} mode="create" />
      </div>
    </div>
  );
}
