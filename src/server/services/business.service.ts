import { prisma } from "@/lib/db";
import { auditService } from "./audit.service";
import { encryptSecret } from "@/lib/crypto/secret-box";

// Self-service tenant creation. The registering user becomes that business's
// first ADMIN and its active business, in one atomic step.
export const businessService = {
  async register(userId: string, name: string) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.create({ data: { name } });
      await tx.businessMember.create({
        data: { businessId: business.id, userId, role: "ADMIN" },
      });
      await tx.user.update({ where: { id: userId }, data: { activeBusinessId: business.id } });
      await auditService.log(tx, {
        businessId: business.id, actorId: userId, action: "BUSINESS_REGISTERED",
        entityType: "Business", entityId: business.id, metadata: { name },
      });
      return business;
    });
  },

  async updateName(businessId: string, actorId: string, name: string) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.update({ where: { id: businessId }, data: { name } });
      await auditService.log(tx, {
        businessId, actorId, action: "BUSINESS_UPDATED", entityType: "Business", entityId: businessId,
        metadata: { name },
      });
      return business;
    });
  },

  async setLogo(businessId: string, actorId: string, logoUrl: string | null) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.update({ where: { id: businessId }, data: { logoUrl } });
      await auditService.log(tx, {
        businessId, actorId, action: "BUSINESS_LOGO_UPDATED", entityType: "Business", entityId: businessId,
        metadata: { logoUrl },
      });
      return business;
    });
  },

  // apiKey: null clears it (reverts to the shared default key). Never logged
  // in audit metadata — only whether a key is now set, not its value.
  async setGeminiApiKey(businessId: string, actorId: string, apiKey: string | null) {
    const geminiApiKeyEncrypted = apiKey ? encryptSecret(apiKey) : null;
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.update({ where: { id: businessId }, data: { geminiApiKeyEncrypted } });
      await auditService.log(tx, {
        businessId, actorId, action: "BUSINESS_API_KEY_UPDATED", entityType: "Business", entityId: businessId,
        metadata: { hasKey: !!apiKey },
      });
      return business;
    });
  },
};
