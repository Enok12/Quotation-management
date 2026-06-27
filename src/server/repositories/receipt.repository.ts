import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const fullInclude = {
  items: { orderBy: { sortOrder: "asc" } },
  adjustments: { orderBy: { sortOrder: "asc" } },
  customer: true,
} satisfies Prisma.ReceiptInclude;

export const receiptRepository = {
  list(args: {
    where: Prisma.ReceiptWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.ReceiptOrderByWithRelationInput;
  }) {
    return Promise.all([
      prisma.receipt.count({ where: args.where }),
      prisma.receipt.findMany({
        where: args.where,
        skip: args.skip,
        take: args.take,
        orderBy: args.orderBy,
        select: {
          id: true, receiptNumber: true, custName: true, date: true,
          totalDue: true, balance: true, status: true, orderStatus: true,
          createdAt: true,
        },
      }),
    ]);
  },

  findFull(id: string) {
    return prisma.receipt.findUnique({ where: { id }, include: fullInclude });
  },

  listVersions(receiptId: string) {
    return prisma.receiptVersion.findMany({
      where: { receiptId },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, changeSummary: true, createdAt: true, modifiedById: true },
    });
  },
};

export type FullReceipt = Prisma.ReceiptGetPayload<{ include: typeof fullInclude }>;
