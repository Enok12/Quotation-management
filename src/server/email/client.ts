import { Resend } from "resend";

// Transactional email, currently used only for notifying a business when a
// customer completes self-registration.
//
// Every send is best-effort by design: notifications must NEVER be able to
// fail the user action that triggered them. A customer who filled in the
// registration form correctly has registered — whether the shop owner's
// notification went out is a separate concern, and an email outage must not
// surface to them as a failed submission.

// Without a verified domain, Resend only accepts this sender, and only
// delivers to the address the Resend account itself is registered under —
// which is exactly the "notify the owner" case, so this works with no domain.
// Set EMAIL_FROM once a domain is verified (e.g. "MONTRA <no-reply@yourdomain.com>").
const FROM = process.env.EMAIL_FROM ?? "MONTRA <onboarding@resend.dev>";

// Instantiated lazily so a missing key is a no-op rather than a crash at
// import time — local dev and any business without email configured keep
// working normally.
let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  /** Why it didn't send, for logging. Never surfaced to an end user. */
  reason?: "no-api-key" | "no-recipient" | "error";
}

/**
 * Sends an email, swallowing every failure. Returns whether it actually went
 * out so callers can log it; callers must not branch their own success on it.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!message.to) return { sent: false, reason: "no-recipient" };

  const resend = getClient();
  if (!resend) {
    // Expected in local dev and before a key is configured — log the intent
    // so the flow is still observable without a provider.
    console.info(`[email] RESEND_API_KEY not set; skipping "${message.subject}" to ${message.to}`);
    return { sent: false, reason: "no-api-key" };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      console.error(`[email] Failed to send "${message.subject}":`, error);
      return { sent: false, reason: "error" };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send "${message.subject}":`, err);
    return { sent: false, reason: "error" };
  }
}
