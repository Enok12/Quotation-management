import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CustomerListQuery } from "@/lib/validation/customer.schema";

// Repository layer = the ONLY place that talks to Prisma for this entity.
// Services depend on these functions, never on Prisma directly.
export const customerRepository = {
  async list(q: CustomerListQuery) {
    const where: Prisma.CustomerWhereInput = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" } },
            { phone: { contains: q.search, mode: "insensitive" } },
            { email: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {};

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

  findById(id: string) {
    return prisma.customer.findUnique({ where: { id } });
  },

  create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data });
  },

  update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data });
  },
};
