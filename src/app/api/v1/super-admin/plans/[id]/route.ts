import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SECTIONS = ["CUSTOMERS", "RECEIPTS", "ORDERS", "PRODUCTION", "EXPENSES", "INCOME", "TEAM", "AUDIT_LOG", "SETTINGS"] as const;
const bodySchema = z.object({
  name: z.string().trim().min(2).max(60),
  enabledSections: z.array(z.enum(SECTIONS)),
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
