import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = handler(async () => {
  await requireUser();

  const [
    totalCustomers,
    draftReceipts,
    finalizedReceipts,
    pendingOrders,
    inProgressOrders,
    completedOrders,
    cancelledOrders,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.receipt.count({ where: { status: "DRAFT" } }),
    prisma.receipt.count({ where: { status: "FINALIZED" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "PENDING" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "IN_PROGRESS" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "COMPLETED" } }),
    prisma.receipt.count({ where: { status: "FINALIZED", orderStatus: "CANCELLED" } }),
  ]);

  return ok({
    totalCustomers,
    totalReceipts: draftReceipts + finalizedReceipts,
    draftReceipts,
    finalizedReceipts,
    pendingOrders,
    inProgressOrders,
    completedOrders,
    cancelledOrders,
  });
});
