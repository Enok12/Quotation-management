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

// Super Admin only: create a new named plan (bundle of enabled sections).
export const POST = handler(async (req: NextRequest) => {
  await requireSuperAdmin();
  const { name, enabledSections } = bodySchema.parse(await req.json());
  const plan = await prisma.plan.create({ data: { name, enabledSections } });
  return ok({ id: plan.id, name: plan.name }, 201);
});
