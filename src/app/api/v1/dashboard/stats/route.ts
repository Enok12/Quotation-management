import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = handler(async () => {
  await requireUser();

  const [totalCustomers, draftReceipts, finalizedReceipts, byStage] = await Promise.all([
    prisma.customer.count(),
    prisma.receipt.count({ where: { status: "DRAFT" } }),
    prisma.receipt.count({ where: { status: "FINALIZED" } }),
    prisma.receipt.groupBy({ by: ["orderStatus"], where: { status: "FINALIZED" }, _count: true }),
  ]);
  const stage = (s: string) => byStage.find((b) => b.orderStatus === s)?._count ?? 0;

  return ok({
    totalCustomers,
    totalReceipts: draftReceipts + finalizedReceipts,
    draftReceipts,
    finalizedReceipts,
    stages: {
      FABRIC_SELECTION: stage("FABRIC_SELECTION"),
      CUTTING: stage("CUTTING"),
      PRODUCTION: stage("PRODUCTION"),
      QUALITY_CHECK: stage("QUALITY_CHECK"),
      IRON_PACKING: stage("IRON_PACKING"),
      DELIVERY: stage("DELIVERY"),
    },
  });
});
