import type { NextConfig } from "next";

const securityHeaders = [
  // Force HTTPS for 1 year — prevents "not secure" warning on mobile
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Control referrer info sent to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser features (HIPAA-friendly)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },
  async redirects() {
    return [
      { source: "/briefing", destination: "/", permanent: false },
      { source: "/intelligence", destination: "/analytics", permanent: false },
      { source: "/auth-check", destination: "/eligibility", permanent: false },
    ]
  },
};

export default nextConfig;
