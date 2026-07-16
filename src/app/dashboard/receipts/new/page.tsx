import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ReceiptBuilder } from "@/components/receipts/receipt-builder";
import { CustomerPickerShell } from "@/components/receipts/customer-picker-shell";

// Whitelisted so `batchReturn` (which comes back from the client as a plain
// query param) can only ever point at one of the two known bulk-upload
// queues — never an arbitrary redirect target.
const KNOWN_BATCH_RETURN_PATHS = new Set([
  "/dashboard/receipts/new/bulk",
  "/dashboard/receipts/new/bulk-sample",
]);

interface Props { searchParams: Promise<{ customerId?: string; batchItem?: string; batchReturn?: string }> }

export const metadata = { title: "New Receipt" };

export default async function NewReceiptPage({ searchParams }: Props) {
  const { businessId } = await requireBusiness();
  const { customerId, batchItem, batchReturn } = await searchParams;
  const returnBase =
    batchReturn && KNOWN_BATCH_RETURN_PATHS.has(batchReturn) ? batchReturn : "/dashboard/receipts/new/bulk";
  const returnTo = batchItem ? `${returnBase}?completed=${encodeURIComponent(batchItem)}` : undefined;

  if (!customerId) {
    // Show customer picker first
    const [customers, business] = await Promise.all([
      prisma.customer.findMany({
        where: { businessId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true, email: true },
      }),
      prisma.business.findUnique({ where: { id: businessId }, select: { geminiApiKeyEncrypted: true } }),
    ]);
    return <CustomerPickerShell customers={customers} hasApiKey={!!business?.geminiApiKeyEncrypted} />;
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
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
        <ReceiptBuilder customer={customer} mode="create" returnTo={returnTo} />
      </div>
    </div>
  );
}
