import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep experimental offline retries OFF — they left soft-nav stuck on blank
  // main content on iPhone when a fetch hung or returned stale RSC.
};

export default nextConfig;
