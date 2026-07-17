import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/api/errors";

const bodySchema = z.object({ businessId: z.string().min(1) });

// Switches which of the current user's businesses is "active" — every other
// business-scoped page/route reads this via requireBusiness(). Doesn't touch
// membership itself, just the pointer, so switching back and forth is free.
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { businessId } = bodySchema.parse(await req.json());

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: user.id } },
  });
  if (!membership) throw new ForbiddenError("You're not a member of that business");

  await prisma.user.update({ where: { id: user.id }, data: { activeBusinessId: businessId } });
  return ok({ businessId });
});
