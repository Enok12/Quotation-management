import type { EmailMessage } from "../client";

export interface CustomerRegisteredData {
  businessName: string;
  customerId: string;
  name: string;
  phone?: string | null;
  otherPhone?: string | null;
  email?: string | null;
  address?: string | null;
  nic?: string | null;
  /** Absolute base URL of the app, for a link straight to the new record. */
  appUrl: string;
}

// Escaped because every value here is attacker-controlled: the form is public
// (anyone with the invite link can submit it), so an unescaped name could
// inject markup into the notification an admin opens.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function customerRegisteredEmail(data: CustomerRegisteredData): EmailMessage {
  const link = `${data.appUrl.replace(/\/$/, "")}/dashboard/customers/${data.customerId}`;

  const fields: [string, string | null | undefined][] = [
    ["Phone", data.phone],
    ["Other Phone", data.otherPhone],
    ["Email", data.email],
    ["NIC", data.nic],
    ["Address", data.address],
  ];
  const present = fields.filter((f): f is [string, string] => Boolean(f[1]));

  const rows = present
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#78716c;font-size:13px;">${esc(label)}</td>` +
        `<td style="padding:4px 0;color:#0a0a0a;font-size:13px;">${esc(value)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px;padding:24px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e;">${esc(data.businessName)}</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#0a0a0a;">New customer registered</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#44403c;">
      <strong>${esc(data.name)}</strong> just registered through your customer registration link.
    </p>
    <table style="border-collapse:collapse;margin-bottom:20px;">${rows}</table>
    <a href="${esc(link)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:13px;padding:9px 16px;border-radius:5px;">View customer</a>
  </div>
</body></html>`;

  const text = [
    `${data.businessName} — new customer registered`,
    "",
    `${data.name} just registered through your customer registration link.`,
    "",
    ...present.map(([label, value]) => `${label}: ${value}`),
    "",
    `View customer: ${link}`,
  ].join("\n");

  return { to: "", subject: `New customer registered: ${data.name}`, html, text };
}
