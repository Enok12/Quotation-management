import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireBusiness } from "@/lib/auth";
import { customerService } from "@/server/services/customer.service";
import { customerCreateSchema, customerListQuerySchema } from "@/lib/validation/customer.schema";

export const GET = handler(async (req: NextRequest) => {
  const { businessId } = await requireBusiness();
  const query = customerListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await customerService.list(query, businessId));
});

export const POST = handler(async (req: NextRequest) => {
  const { id: userId, businessId } = await requireBusiness();
  const body = customerCreateSchema.parse(await req.json());
  return ok(await customerService.create(body, userId, businessId), 201);
});
