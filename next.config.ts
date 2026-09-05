import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

const nextConfig: NextConfig = {
  // Money tabs must not keep a 5‑minute stale RSC payload after a mutation.
  // Correctness > tab-cache convenience for Hem / Plan / Analys.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 600,
    },
    optimizePackageImports: ["date-fns-tz", "zod"],
  },
  poweredByHeader: false,
  // DSN is a public ingest key. Map the existing Vercel SENTRY_DSN into the
  // client bundle so browser errors work without a second env var.
  env: {
    SENTRY_DSN: sentryDsn,
  },
  async redirects() {
    return [{ source: "/import", destination: "/fota", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

const hasSourceMapAuth = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "numa-finance",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: hasSourceMapAuth,
  sourcemaps: {
    disable: !hasSourceMapAuth,
  },
  tunnelRoute: "/sentry-tunnel",
});
