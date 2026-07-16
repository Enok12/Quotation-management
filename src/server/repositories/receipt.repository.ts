import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const fullInclude = {
  items: { orderBy: { sortOrder: "asc" } },
  adjustments: { orderBy: { sortOrder: "asc" } },
  customer: true,
  business: { select: { name: true, logoUrl: true } },
} satisfies Prisma.ReceiptInclude;

export const receiptRepository = {
  // businessId is its own required argument, merged into `where` here rather
  // than left to each caller to remember — see customer.repository.ts.
  list(args: {
    businessId: string;
    where?: Prisma.ReceiptWhereInput;
    skip: number;
    take: number;
    orderBy: Prisma.ReceiptOrderByWithRelationInput;
  }) {
    const where: Prisma.ReceiptWhereInput = { ...args.where, businessId: args.businessId };
    return Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
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

  // findFirst (not findUnique) so a wrong-business id returns null exactly
  // like a nonexistent one — never distinguishes "not yours" from "not real".
  findFull(id: string, businessId: string) {
    return prisma.receipt.findFirst({ where: { id, businessId }, include: fullInclude });
  },

  listVersions(receiptId: string, businessId: string) {
    return prisma.receiptVersion.findMany({
      where: { receiptId, receipt: { businessId } },
      orderBy: { versionNumber: "desc" },
      select: { id: true, versionNumber: true, changeSummary: true, createdAt: true, modifiedById: true },
    });
  },
};

export type FullReceipt = Prisma.ReceiptGetPayload<{ include: typeof fullInclude }>;
