import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CustomerListQuery } from "@/lib/validation/customer.schema";

// Repository layer = the ONLY place that talks to Prisma for this entity.
// Services depend on these functions, never on Prisma directly. Reads take
// businessId as their own required argument (merged in here, not left to the
// caller to remember inside an ad-hoc `where`) so it's structurally
// impossible for a tenant filter to be forgotten.
export const customerRepository = {
  async list(q: CustomerListQuery, businessId: string) {
    const where: Prisma.CustomerWhereInput = {
      businessId,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" } },
              { phone: { contains: q.search, mode: "insensitive" } },
              { email: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // Parallel count + page; select only the fields the table needs.
    const [total, rows] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { [q.sortBy]: q.sortDir },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, name: true, phone: true, email: true, createdAt: true,
          _count: { select: { receipts: true } },
        },
      }),
    ]);
    return { rows, total };
  },

  // findFirst (not findUnique) so a wrong-business id returns null exactly
  // like a nonexistent one — never distinguishes "not yours" from "not real".
  findById(id: string, businessId: string) {
    return prisma.customer.findFirst({ where: { id, businessId } });
  },

  create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data });
  },

  update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data });
  },
};
