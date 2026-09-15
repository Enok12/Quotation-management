import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { returnService } from "@/server/services/return.service";
import { returnCreateSchema } from "@/lib/validation/return.schema";

export const GET = handler(async (req: NextRequest) => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");

  const { searchParams } = new URL(req.url);
  const returns = await returnService.list(businessId, {
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  return ok(returns.map((r) => ({
    id: r.id, sku: r.product.sku, productName: r.product.name,
    quantity: r.quantity, refundAmount: Number(r.refundAmount),
    reason: r.reason, note: r.note,
    processedBy: r.processedBy.name ?? r.processedBy.email, createdAt: r.createdAt.toISOString(),
  })));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");

  const body = returnCreateSchema.parse(await req.json());
  const ret = await returnService.create(body, userId, businessId);
  return ok({ id: ret.id }, 201);
});
