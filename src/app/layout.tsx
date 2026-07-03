import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "MONTRA", template: "%s — MONTRA" },
  description: "Clothing & Manufacturing — Receipt Management",
};

// Runs before first paint so the correct theme applies immediately — no
// flash of the wrong theme while React hydrates.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("montra-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: the theme-init script below adds/removes
          "dark" on this element before React hydrates, which is expected to
          differ from the server-rendered markup — not a real mismatch. */}
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
            rel="stylesheet"
          />
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body className="bg-canvas text-ink antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
