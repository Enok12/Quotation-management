import { customerRepository } from "../repositories/customer.repository";
import { auditService } from "./audit.service";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/api/errors";
import type {
  CustomerCreateInput,
  CustomerListQuery,
} from "@/lib/validation/customer.schema";

// Service layer = business rules. No HTTP, no Prisma details — reusable by
// web routes, future mobile API, or background jobs.
export const customerService = {
  async list(query: CustomerListQuery) {
    const { rows, total } = await customerRepository.list(query);
    return {
      items: rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  },

  async getById(id: string) {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new NotFoundError("Customer");
    return customer;
  },

  async create(input: CustomerCreateInput, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: { ...input, email: input.email || null },
      });
      await auditService.log(tx, {
        actorId, action: "CUSTOMER_CREATED",
        entityType: "Customer", entityId: customer.id,
      });
      return customer;
    });
  },

  async update(id: string, input: Partial<CustomerCreateInput>, actorId: string) {
    await this.getById(id);
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({ where: { id }, data: input });
      await auditService.log(tx, {
        actorId, action: "CUSTOMER_UPDATED",
        entityType: "Customer", entityId: id, metadata: { changed: Object.keys(input) },
      });
      return customer;
    });
  },

  async remove(id: string) {
    await this.getById(id);
    return customerRepository.delete(id);
  },
};
