import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireSuperAdmin } from "@/lib/auth";
import { businessService } from "@/server/services/business.service";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  planId: z.string().min(1).optional(),
  subscriptionStatus: z.enum(["ACTIVE", "TRIAL", "EXPIRED", "CANCELLED"]).optional(),
  subscriptionRenewsAt: z.string().datetime().optional().nullable(),
});

// Super Admin only: reassign a business's plan and/or subscription status.
export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const { planId, subscriptionStatus, subscriptionRenewsAt } = bodySchema.parse(await req.json());

  let business;
  if (planId) business = await businessService.setPlan(id, admin.id, planId);
  if (subscriptionStatus) {
    business = await businessService.setSubscriptionStatus(
      id, admin.id, subscriptionStatus,
      subscriptionRenewsAt !== undefined ? (subscriptionRenewsAt ? new Date(subscriptionRenewsAt) : null) : undefined,
    );
  }
  return ok({ id: business?.id ?? id });
});
