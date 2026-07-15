import type { MetadataRoute } from "next"

const SITE_URL = "https://claima.io"

// Public, indexable marketing/legal routes only. The authenticated app is
// excluded (and disallowed in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-15")
  return [
    { url: `${SITE_URL}/`,         lastModified, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/security`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`,  lastModified, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/terms`,    lastModified, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/login`,    lastModified, changeFrequency: "yearly",  priority: 0.4 },
    { url: `${SITE_URL}/signup`,   lastModified, changeFrequency: "yearly",  priority: 0.5 },
  ]
}
