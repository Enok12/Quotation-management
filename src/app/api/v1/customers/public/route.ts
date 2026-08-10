import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { customerCreateSchema } from "@/lib/validation/customer.schema";
import { notifyCustomerRegistered } from "@/server/email/notify";
import { z, ZodError } from "zod";

// Public self-registration — gated by an invite token, so the form can only
// be submitted via a link staff explicitly generated. The link is REUSABLE
// (a single shared link per business): it isn't consumed on submission, so
// any number of customers can register through the same link.
const bodySchema = customerCreateSchema.extend({ token: z.string().min(1) });

// Thrown when the token is missing or expired.
class InviteError extends Error {}

export async function POST(req: NextRequest) {
  try {
    const { token, ...data } = bodySchema.parse(await req.json());

    // Resolve the token to its business without consuming it — the link is
    // shared and stays valid for every customer. (expiresAt is null for links
    // created now, but an older link may carry one, so it's still honored.)
    const invite = await prisma.customerInvite.findUnique({
      where: { token },
      select: { businessId: true, expiresAt: true },
    });
    if (!invite) throw new InviteError();
    if (invite.expiresAt && invite.expiresAt <= new Date()) throw new InviteError();

    const customer = await prisma.customer.create({
      data: { ...data, businessId: invite.businessId, email: data.email || null },
    });

    // Notify the business — after the customer is saved, and awaited before
    // responding. Awaiting matters on serverless: the function can be frozen
    // the moment the response is returned, so a fire-and-forget promise would
    // often never actually run. The call swallows all of its own failures, so
    // this can't turn a successful registration into an error for the customer.
    await notifyCustomerRegistered(customer.id);

    return ok({ id: customer.id }, 201);
  } catch (err) {
    if (err instanceof InviteError) {
      return fail("This registration link is invalid or has expired.", 410);
    }
    if (err instanceof ZodError) return fail("Validation failed", 422, err.issues);
    return fail("Failed to submit. Please try again.", 500);
  }
}
