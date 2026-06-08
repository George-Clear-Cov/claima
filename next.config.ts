import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/briefing", destination: "/", permanent: false },
      { source: "/intelligence", destination: "/analytics", permanent: false },
      { source: "/auth-check", destination: "/eligibility", permanent: false },
    ]
  },
};

export default nextConfig;
