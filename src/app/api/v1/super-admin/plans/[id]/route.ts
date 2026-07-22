import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Section } from "@prisma/client";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  // nativeEnum, not a hand-listed tuple: a new Section in the schema is
  // accepted automatically instead of being silently rejected as invalid.
  enabledSections: z.array(z.nativeEnum(Section)),
});

type Ctx = { params: Promise<{ id: string }> };

// Super Admin only: rename a plan / change which sections it includes.
// Every business currently on this plan is affected immediately.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  await requireSuperAdmin();
  const { id } = await params;
  const { name, enabledSections } = bodySchema.parse(await req.json());
  const plan = await prisma.plan.update({ where: { id }, data: { name, enabledSections } });
  return ok({ id: plan.id, name: plan.name });
});
