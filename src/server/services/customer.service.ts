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
  async list(query: CustomerListQuery, businessId: string) {
    const { rows, total } = await customerRepository.list(query, businessId);
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

  async getById(id: string, businessId: string) {
    const customer = await customerRepository.findById(id, businessId);
    if (!customer) throw new NotFoundError("Customer");
    return customer;
  },

  async create(input: CustomerCreateInput, actorId: string, businessId: string) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: { ...input, businessId, email: input.email || null },
      });
      await auditService.log(tx, {
        businessId, actorId, action: "CUSTOMER_CREATED",
        entityType: "Customer", entityId: customer.id,
      });
      return customer;
    });
  },

  async update(id: string, input: Partial<CustomerCreateInput>, actorId: string, businessId: string) {
    const existing = await this.getById(id, businessId);
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({ where: { id }, data: input });
      await auditService.log(tx, {
        businessId: existing.businessId, actorId, action: "CUSTOMER_UPDATED",
        entityType: "Customer", entityId: id, metadata: { changed: Object.keys(input) },
      });
      return customer;
    });
  },

  // Deleting a customer also deletes all of their receipts (and, via cascade,
  // each receipt's items/adjustments/payments/versions/order history). The
  // caller is expected to have already confirmed this with the user.
  async remove(id: string, actorId: string, businessId: string) {
    const customer = await this.getById(id, businessId);

    return prisma.$transaction(async (tx) => {
      // Detach any registration invite that produced this customer — the FK
      // has no cascade, so it would otherwise block the delete.
      await tx.customerInvite.updateMany({ where: { customerId: id }, data: { customerId: null } });

      // orderType comes back too: Bulk and Sample number independently, so
      // the caller needs both to delete the right PDF from the synced folder.
      const receipts = await tx.receipt.findMany({ where: { customerId: id }, select: { id: true, receiptNumber: true, orderType: true } });
      await tx.receipt.deleteMany({ where: { customerId: id } });

      await tx.customer.delete({ where: { id } });

      await auditService.log(tx, {
        businessId: customer.businessId, actorId, action: "CUSTOMER_DELETED", entityType: "Customer", entityId: id,
        metadata: { name: customer.name, receiptsDeleted: receipts.length },
      });

      return { id, receipts: receipts.map((r) => ({ id: r.id, receiptNumber: r.receiptNumber, orderType: r.orderType })) };
    });
  },
};
