import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = handler(async () => {
  const { businessId } = await requireBusiness();

  const [totalCustomers, totalReceipts, byStage] = await Promise.all([
    prisma.customer.count({ where: { businessId } }),
    prisma.receipt.count({ where: { businessId } }),
    prisma.receipt.groupBy({ by: ["orderStatus"], _count: true, where: { businessId } }),
  ]);
  const stage = (s: string) => byStage.find((b) => b.orderStatus === s)?._count ?? 0;

  return ok({
    totalCustomers,
    totalReceipts,
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
