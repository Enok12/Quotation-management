import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { customerService } from "@/server/services/customer.service";
import { customerCreateSchema, customerListQuerySchema } from "@/lib/validation/customer.schema";

export const GET = handler(async (req: NextRequest) => {
  await requireUser();
  const query = customerListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return ok(await customerService.list(query));
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = customerCreateSchema.parse(await req.json());
  return ok(await customerService.create(body, user.id), 201);
});
