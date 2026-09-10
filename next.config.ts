import type { NextConfig } from "next";

const deployStamp =
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
  "";

const nextConfig: NextConfig = {
  // Stamp the client + SW with the git SHA so every production deploy changes
  // /sw.js bytes and home-screen apps can pick up updates on restart.
  env: {
    NEXT_PUBLIC_NUMA_BUILD_ID:
      process.env.NEXT_PUBLIC_NUMA_BUILD_ID?.trim() || deployStamp,
  },
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
        // Brand PNGs are tiny — prefer revalidate over a week-long sticky
        // owl after a rebrand. URLs are also ?v=-busted via brand-assets.
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
