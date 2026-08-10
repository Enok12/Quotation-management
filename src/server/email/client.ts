// Transactional email, currently used only for notifying a business when a
// customer completes self-registration.
//
// Provider: Resend (https://resend.com), called over its plain HTTP API with
// fetch — no SDK, which keeps the dependency surface small and behaves well on
// Vercel's serverless functions. Swapping providers means changing only this
// file: the sendEmail() signature every caller depends on stays the same.
//
// Every send is best-effort by design: notifications must NEVER be able to
// fail the user action that triggered them. A customer who filled in the
// registration form correctly has registered — whether the shop owner's
// notification went out is a separate concern, and an email outage must not
// surface to them as a failed submission.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// The sender. Without a verified domain, Resend only accepts "onboarding@
// resend.dev" and only DELIVERS to the address your Resend account is
// registered under — which is exactly the "email me when a customer registers"
// case. Once a domain is verified, set EMAIL_FROM (e.g. "MONTRA
// <notifications@yourdomain.com>") to send from your own address to anyone.
const FROM = process.env.EMAIL_FROM ?? "MONTRA <onboarding@resend.dev>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendResult {
  sent: boolean;
  /** Why it didn't send, for logging. Never surfaced to an end user. */
  reason?: "not-configured" | "no-recipient" | "error";
}

/**
 * Sends an email, swallowing every failure. Returns whether it actually went
 * out so callers can log it; callers must not branch their own success on it.
 *
 * A missing API key is a silent no-op (logged), so local dev and any
 * environment without email configured keep working normally.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!message.to) return { sent: false, reason: "no-recipient" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Expected before the key is configured — log the intent so the flow is
    // still observable without a provider wired up.
    console.info(`[email] RESEND_API_KEY not set; skipping "${message.subject}" to ${message.to}`);
    return { sent: false, reason: "not-configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      // Resend returns a JSON error body; include it so a rejected sender or a
      // bad key is diagnosable from the server logs.
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend rejected "${message.subject}" (HTTP ${res.status}): ${detail}`);
      return { sent: false, reason: "error" };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send "${message.subject}":`, err);
    return { sent: false, reason: "error" };
  }
}
