import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Instant soft navigations; avoid experimental offline retries that blanked iPhone.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
