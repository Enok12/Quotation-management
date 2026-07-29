import { prisma } from "@/lib/db";
import { sendEmail } from "./client";
import { customerRegisteredEmail } from "./templates/customer-registered";
import { appBaseUrl } from "@/lib/app-url";

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
      appUrl: appBaseUrl(),
    });

    await sendEmail({ ...message, to: customer.business.notificationEmail });
  } catch (err) {
    // Belt-and-braces: sendEmail already swallows its own failures, so this
    // only catches something unexpected (e.g. the lookup query failing).
    console.error("[email] notifyCustomerRegistered failed:", err);
  }
}
