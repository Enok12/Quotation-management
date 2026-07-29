// Transactional email, currently used only for notifying a business when a
// customer completes self-registration.
//
// Provider: Brevo (https://brevo.com), called over its plain HTTP API with
// fetch — no SDK, which keeps the dependency surface small and behaves well
// on Vercel's serverless functions (unlike SMTP, which wants a persistent
// connection). Swapping providers later means changing only this file: the
// sendEmail() signature every caller depends on stays the same.
//
// Why Brevo over Resend: Brevo lets you verify a SINGLE sender email address
// (e.g. an ordinary Gmail) rather than a whole domain, and once verified it
// delivers to ANY recipient. That's exactly what's needed here — every
// business receives notifications at its own configured address, with no
// domain to buy and nothing to set up per business.
//
// Every send is best-effort by design: notifications must NEVER be able to
// fail the user action that triggered them. A customer who filled in the
// registration form correctly has registered — whether the shop owner's
// notification went out is a separate concern, and an email outage must not
// surface to them as a failed submission.

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

// The verified sender. EMAIL_FROM_EMAIL must be an address verified in the
// Brevo dashboard (Senders → verify) — until it is, Brevo rejects the send.
// EMAIL_FROM_NAME is just the display name shown to the recipient.
const FROM_EMAIL = process.env.EMAIL_FROM_EMAIL;
const FROM_NAME = process.env.EMAIL_FROM_NAME ?? "MONTRA";

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
 * A missing API key or unset sender is a silent no-op (logged), so local dev
 * and any environment without email configured keep working normally.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!message.to) return { sent: false, reason: "no-recipient" };

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey || !FROM_EMAIL) {
    // Expected before credentials are configured — log the intent so the flow
    // is still observable without a provider wired up.
    console.info(`[email] Email not configured (BREVO_API_KEY / EMAIL_FROM_EMAIL); skipping "${message.subject}" to ${message.to}`);
    return { sent: false, reason: "not-configured" };
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });

    if (!res.ok) {
      // Brevo returns a JSON error body; include it so a rejected sender or
      // bad key is diagnosable from the server logs.
      const detail = await res.text().catch(() => "");
      console.error(`[email] Brevo rejected "${message.subject}" (HTTP ${res.status}): ${detail}`);
      return { sent: false, reason: "error" };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send "${message.subject}":`, err);
    return { sent: false, reason: "error" };
  }
}
