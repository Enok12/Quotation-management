// Absolute base URL of the app, for building links that leave the app —
// email bodies, and the public receipt-PDF link shared over WhatsApp.
//
// VERCEL_URL is set automatically on every deployment (without a scheme), so
// this works in production with no extra configuration; NEXT_PUBLIC_APP_URL
// overrides it once a custom domain is in place. No trailing slash.
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
