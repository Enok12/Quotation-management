import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { requireSection } from "@/lib/section-access";
import { codService } from "@/server/services/cod.service";

const statuses = ["PENDING_CONFIRMATION", "PENDING_DISPATCH", "OUT_FOR_DELIVERY", "DELIVERED", "REMITTED", "REFUSED", "CANCELLED"] as const;

const querySchema = z.object({
  status: z.string().optional().transform((v) => (v ? v.split(",") : [])).pipe(z.array(z.enum(statuses))),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = handler(async (req: NextRequest) => {
  const { businessId, role } = await requireBusiness();
  await requireSection(businessId, role, "SALES");

  const q = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows, total, page, pageSize, refusalByPhone } = await codService.list(businessId, q);
  return ok({
    total, page, pageSize,
    orders: rows.map((r) => ({
      saleId: r.saleId, dispatchRef: r.dispatchRef, status: r.status,
      customerName: r.customerName, customerPhone: r.customerPhone, deliveryAddress: r.deliveryAddress,
      courierName: r.courierName, waybillNo: r.waybillNo,
      codAmount: Number(r.codAmount), deliveryFee: Number(r.deliveryFee), feePaidBy: r.feePaidBy,
      createdAt: r.createdAt.toISOString(), earlierRefusals: refusalByPhone.get(r.customerPhoneNormalized) ?? 0,
    })),
  });
});
