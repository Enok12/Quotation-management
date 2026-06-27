import { NextRequest } from "next/server";
import { handler, ok } from "@/lib/api/response";
import { requireUser, requireAdmin } from "@/lib/auth";
import { customerService } from "@/server/services/customer.service";
import { customerUpdateSchema } from "@/lib/validation/customer.schema";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: NextRequest, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  return ok(await customerService.getById(id));
});

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const body = customerUpdateSchema.parse(await req.json());
  return ok(await customerService.update(id, body, user.id));
});

export const DELETE = handler(async (_req: NextRequest, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  await customerService.remove(id);
  return ok({ id });
});
