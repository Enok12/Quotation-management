import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BulkUploadShell } from "@/components/receipts/bulk-upload-shell";

interface Props { searchParams: Promise<{ completed?: string }> }
export const metadata = { title: "Bulk Upload Receipts" };

export default async function BulkUploadReceiptsPage({ searchParams }: Props) {
  await requireUser();
  const { completed } = await searchParams;

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, email: true },
  });

  return <BulkUploadShell customers={customers} completedItemId={completed} />;
}
