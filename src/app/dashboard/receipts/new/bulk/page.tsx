import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { BulkUploadShell } from "@/components/receipts/bulk-upload-shell";

interface Props { searchParams: Promise<{ completed?: string }> }
export const metadata = { title: "Bulk Upload Receipts" };

export default async function BulkUploadReceiptsPage({ searchParams }: Props) {
  const { businessId } = await requireBusiness();
  const { completed } = await searchParams;

  const [customers, business] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, otherPhone: true, email: true },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { geminiApiKeyEncrypted: true } }),
  ]);

  return (
    <BulkUploadShell
      customers={customers}
      completedItemId={completed}
      orderType="BULK"
      hasApiKey={!!business?.geminiApiKeyEncrypted}
    />
  );
}
