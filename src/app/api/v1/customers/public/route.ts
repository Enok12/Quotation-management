import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { customerCreateSchema } from "@/lib/validation/customer.schema";
import { ZodError } from "zod";

// No authentication — publicly accessible for customer self-registration.
// Rate limiting should be added at the infrastructure layer (Vercel, Cloudflare).
export async function POST(req: NextRequest) {
  try {
    const body = customerCreateSchema.parse(await req.json());
    const customer = await prisma.customer.create({
      data: { ...body, email: body.email || null },
    });
    return ok({ id: customer.id }, 201);
  } catch (err) {
    if (err instanceof ZodError) return fail("Validation failed", 422, err.issues);
    return fail("Failed to submit. Please try again.", 500);
  }
}
