import type { MetadataRoute } from "next"

const SITE_URL = "https://claima.io"

// Per-practice profile pages, built from public CMS data. These are the whole point of the
// programmatic-content play: a prospect finds their own page by searching their own name, and
// every outbound email can link to something they can verify without replying to anyone.
import practices from "@/data/practices.json"
import { publishedPractices, type PracticeRecord } from "@/lib/practices"

// Public, indexable marketing/legal routes only. The authenticated app is
// excluded (and disallowed in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-07-15")
  return [
    { url: `${SITE_URL}/`,             lastModified, changeFrequency: "weekly",  priority: 1.0 },
    // The free diagnostic is the top of the funnel — every other channel points at it.
    { url: `${SITE_URL}/leak-report`,  lastModified: new Date("2026-09-03"), changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date("2026-09-13"), changeFrequency: "monthly", priority: 0.9 },
    ...publishedPractices(practices as unknown as PracticeRecord[]).map((p) => ({
      url: `${SITE_URL}/p/${p.slug}`,
      lastModified: new Date("2026-09-13"),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/security`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`,  lastModified, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/terms`,    lastModified, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/login`,    lastModified, changeFrequency: "yearly",  priority: 0.4 },
    { url: `${SITE_URL}/signup`,   lastModified, changeFrequency: "yearly",  priority: 0.5 },
  ]
}
