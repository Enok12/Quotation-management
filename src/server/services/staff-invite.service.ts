import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import { generateToken } from "@/lib/utils/token";

// Invite links are valid for 48 hours from generation (and single-use) — same
// window as CustomerInvite, for consistency.
const EXPIRY_MS = 48 * 60 * 60 * 1000;

export const staffInviteService = {
  async create(businessId: string, actorId: string, role: Role) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + EXPIRY_MS);
    return prisma.$transaction(async (tx) => {
      const invite = await tx.staffInvite.create({
        data: { businessId, token, role, expiresAt, createdById: actorId },
      });
      await auditService.log(tx, {
        businessId, actorId, action: "STAFF_INVITE_CREATED", entityType: "StaffInvite", entityId: invite.id,
        metadata: { role },
      });
      return invite;
    });
  },

  list(businessId: string) {
    return prisma.staffInvite.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, role: true, expiresAt: true, usedAt: true, createdAt: true,
        createdBy: { select: { name: true, email: true } },
        usedBy: { select: { name: true, email: true } },
      },
    });
  },

  async revoke(id: string, businessId: string, actorId: string) {
    const invite = await prisma.staffInvite.findFirst({ where: { id, businessId } });
    if (!invite) throw new NotFoundError("Invite");
    if (invite.usedAt) throw new ForbiddenError("This invite has already been used");

    return prisma.$transaction(async (tx) => {
      await tx.staffInvite.delete({ where: { id } });
      await auditService.log(tx, {
        businessId, actorId, action: "STAFF_INVITE_REVOKED", entityType: "StaffInvite", entityId: id,
      });
      return { id };
    });
  },

  // Looks up an invite by token for display purposes only — never claims it.
  async preview(token: string) {
    const invite = await prisma.staffInvite.findUnique({
      where: { token },
      select: {
        role: true, expiresAt: true, usedAt: true,
        business: { select: { name: true } },
      },
    });
    if (!invite || invite.usedAt || (invite.expiresAt && invite.expiresAt < new Date())) return null;
    return invite;
  },

  // Redeem: the redeemer is always the currently-authenticated user. Invite
  // links carry no email binding (same design as CustomerInvite) — whoever
  // holds the link and is signed in claims it.
  async redeem(token: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const invite = await tx.staffInvite.findUnique({ where: { token } });
      if (!invite) throw new NotFoundError("Invite");

      // Atomically claim the token — see customers/public/route.ts for the
      // same updateMany-as-lock pattern.
      const claim = await tx.staffInvite.updateMany({
        where: {
          token, usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: { usedAt: new Date(), usedById: userId },
      });
      if (claim.count !== 1) throw new ConflictError("This invite is invalid or has already been used");

      const membership = await tx.businessMember.upsert({
        where: { businessId_userId: { businessId: invite.businessId, userId } },
        create: { businessId: invite.businessId, userId, role: invite.role },
        update: { role: invite.role },
      });
      await tx.user.update({ where: { id: userId }, data: { activeBusinessId: invite.businessId } });
      await auditService.log(tx, {
        businessId: invite.businessId, actorId: userId, action: "STAFF_INVITE_REDEEMED",
        entityType: "StaffInvite", entityId: invite.id, metadata: { role: invite.role },
      });

      const business = await tx.business.findUniqueOrThrow({ where: { id: invite.businessId } });
      return { business, role: membership.role };
    });
  },
};
