import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Every business the current user belongs to — used to render the Switch
// Business control. A person can be a member of more than one (e.g. their
// own business plus one they were invited into as staff/admin elsewhere).
export const GET = handler(async () => {
  const user = await requireUser();
  const memberships = await prisma.businessMember.findMany({
    where: { userId: user.id },
    include: { business: { select: { id: true, name: true, logoUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  return ok(
    memberships.map((m) => ({
      businessId: m.businessId,
      name: m.business.name,
      logoUrl: m.business.logoUrl,
      role: m.role,
      active: m.businessId === user.activeBusinessId,
    })),
  );
});
