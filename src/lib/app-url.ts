// Absolute base URL of the app, for building links that LEAVE the app and are
// opened by people who aren't logged in — email bodies, and the public
// receipt-PDF link shared over WhatsApp. Such links must point at the stable
// production domain, never at a per-deployment preview URL (which Vercel
// password-protects, so a customer would hit a login wall). No trailing slash.
export function appBaseUrl(): string {
  // 1. An explicit override — the custom domain once one is set. Most reliable.
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  // 2. The project's stable PRODUCTION domain. Vercel sets this on every
  //    deployment (including previews), so a link generated from any
  //    deployment still points at production — unlike VERCEL_URL, which is
  //    the deployment-specific host (the "…-czwo8dhv8-…" preview URL).
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

  // 3. Last-resort deployment host — only reached if the production-URL var
  //    isn't available for some reason.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}
