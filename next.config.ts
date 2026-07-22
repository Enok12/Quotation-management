import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ["localhost:3000"] } },

  // The PDF renderer loads these .ttf files at runtime from a path built with
  // process.cwd() (see server/pdf/font-support.ts). Next's dependency tracer
  // only follows static imports, so it cannot see that and would ship the
  // serverless function without them — PDFs would work locally and then fail
  // in production the moment a receipt contained Sinhala. Forcing the fonts
  // into the trace keeps the deployed bundle self-sufficient.
  outputFileTracingIncludes: {
    "/api/v1/receipts/**": ["./src/server/pdf/fonts/**"],
  },
};

export default nextConfig;
