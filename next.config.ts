import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Offline-friendly navigation/action retry foundation (Next.js 16).
    useOffline: true,
  },
};

export default nextConfig;
