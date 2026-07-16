import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { customerCreateSchema } from "@/lib/validation/customer.schema";
import { z, ZodError } from "zod";

// Public self-registration — gated by a one-time invite token, so the form
// can only be submitted via a link staff explicitly generated.
const bodySchema = customerCreateSchema.extend({ token: z.string().min(1) });

// Thrown when the token is missing, already used, or expired.
class InviteError extends Error {}

export async function POST(req: NextRequest) {
  try {
    const { token, ...data } = bodySchema.parse(await req.json());

    const customer = await prisma.$transaction(async (tx) => {
      const invite = await tx.customerInvite.findUnique({ where: { token }, select: { businessId: true } });
      if (!invite) throw new InviteError();

      // Atomically claim the token. updateMany with `usedAt: null` acts as the
      // lock: exactly one concurrent request can flip it, so a shared or
      // double-submitted link can never create a second customer.
      const claim = await tx.customerInvite.updateMany({
        where: {
          token,
          usedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: { usedAt: new Date() },
      });
      if (claim.count !== 1) throw new InviteError();

      const created = await tx.customer.create({
        data: { ...data, businessId: invite.businessId, email: data.email || null },
      });
      await tx.customerInvite.update({
        where: { token },
        data: { customerId: created.id },
      });
      return created;
    });

    return ok({ id: customer.id }, 201);
  } catch (err) {
    if (err instanceof InviteError) {
      return fail("This link is invalid or has already been used.", 410);
    }
    if (err instanceof ZodError) return fail("Validation failed", 422, err.issues);
    return fail("Failed to submit. Please try again.", 500);
  }
}
