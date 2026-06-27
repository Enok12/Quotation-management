import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

// Append-only audit trail. Accepts a transaction client so the log is written
// atomically with the action it records.
export const auditService = {
  log(
    client: Tx,
    input: {
      actorId: string;
      action: AuditAction;
      entityType: string;
      entityId: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return client.auditLog.create({ data: input });
  },
};

export const auditWith = (actorId: string) => ({
  record: (
    client: Tx,
    action: AuditAction,
    entityType: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) => auditService.log(client, { actorId, action, entityType, entityId, metadata }),
});
