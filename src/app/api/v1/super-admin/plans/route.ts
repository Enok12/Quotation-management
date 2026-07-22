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

// Super Admin only: create a new named plan (bundle of enabled sections).
export const POST = handler(async (req: NextRequest) => {
  await requireSuperAdmin();
  const { name, enabledSections } = bodySchema.parse(await req.json());
  const plan = await prisma.plan.create({ data: { name, enabledSections } });
  return ok({ id: plan.id, name: plan.name }, 201);
});
