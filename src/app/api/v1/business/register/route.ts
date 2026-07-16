import { NextRequest } from "next/server";
import { z } from "zod";
import { handler, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth";
import { businessService } from "@/server/services/business.service";

const bodySchema = z.object({ name: z.string().trim().min(2).max(120) });

// Self-service business creation. Any signed-in Clerk user can register a new
// business and becomes its first ADMIN — see /onboarding for the entry point.
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser();
  const { name } = bodySchema.parse(await req.json());
  const business = await businessService.register(user.id, name);
  return ok({ id: business.id, name: business.name }, 201);
});
