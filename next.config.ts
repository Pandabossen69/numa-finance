import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep recently visited tabs in the client router cache so Hem↔Plan↔Analys
  // feel instant instead of re-hitting the server every click.
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 600,
    },
  },
  async redirects() {
    return [{ source: "/import", destination: "/fota", permanent: false }];
  },
};

export default nextConfig;
