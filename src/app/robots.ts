import type { MetadataRoute } from "next"

const SITE_URL = "https://claima.io"

// Marketing surface is crawlable; the authenticated app + API are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/settings/",
        "/onboarding/",
        "/claims/",
        "/denials/",
        "/billing/",
        "/analytics/",
        "/eligibility/",
        "/agent/",
        "/assistant/",
        "/pay/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
