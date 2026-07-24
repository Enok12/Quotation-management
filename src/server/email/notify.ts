import { prisma } from "@/lib/db";
import { sendEmail } from "./client";
import { customerRegisteredEmail } from "./templates/customer-registered";

// Absolute URL for links inside emails. VERCEL_URL is set automatically on
// every deployment (without a scheme), so this works in production without
// extra configuration; NEXT_PUBLIC_APP_URL overrides it once a custom domain
// is in place.
function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Tells a business that a customer self-registered through its invite link.
 *
 * Deliberately never throws and never returns a failure the caller has to
 * handle: it runs AFTER the registration transaction has already committed,
 * so the customer's submission has succeeded regardless of what happens here.
 * A missing notification address, an unset API key, or a provider outage must
 * all be silent no-ops rather than a visible error on a public form.
 */
export async function notifyCustomerRegistered(customerId: string): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true, name: true, phone: true, otherPhone: true, email: true, address: true, nic: true,
        business: { select: { name: true, notificationEmail: true } },
      },
    });
    // Business hasn't configured a notification address — nothing to do.
    if (!customer?.business.notificationEmail) return;

    const message = customerRegisteredEmail({
      businessName: customer.business.name,
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      otherPhone: customer.otherPhone,
      email: customer.email,
      address: customer.address,
      nic: customer.nic,
      appUrl: appUrl(),
    });

    await sendEmail({ ...message, to: customer.business.notificationEmail });
  } catch (err) {
    // Belt-and-braces: sendEmail already swallows its own failures, so this
    // only catches something unexpected (e.g. the lookup query failing).
    console.error("[email] notifyCustomerRegistered failed:", err);
  }
}
