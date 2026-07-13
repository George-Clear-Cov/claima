import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
  // Report-only CSP (non-enforcing) — collects violations without risking breakage of Stripe/Sentry/
  // Next inline. Tighten (drop 'unsafe-inline'/'unsafe-eval', add nonces) and switch to an enforcing
  // Content-Security-Policy after testing in the browser.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://*.sentry.io https://*.ingest.us.sentry.io",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  // Standalone server output for containerized hosting (Azure App Service / Container Apps).
  // No-op on Vercel. See docs/azure-migration.md.
  output: "standalone",
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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  disableLogger: true,
});
