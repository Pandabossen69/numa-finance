import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Offline soft-nav retries were masking blank <main> after the SW incident.
  // Re-enable only with a proven offline shell that never caches HTML/RSC.
  experimental: {},
};

export default nextConfig;
