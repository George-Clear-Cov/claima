// Shared Sentry PHI scrubbing, used by the client/server/edge configs.
// In a medical-billing app, errors, URLs, and breadcrumbs can carry patient identifiers, so we
// strip request bodies, cookies, auth headers, URL query strings, free-form `extra`, and
// breadcrumb URLs before anything leaves the process. Belt-and-suspenders to keeping Sentry
// PHI-free (and its BAA scope small). Typed generically so it drops into beforeSend/beforeBreadcrumb.

type ScrubbableEvent = {
  request?: {
    data?: unknown
    cookies?: unknown
    headers?: Record<string, unknown>
    url?: string
    query_string?: unknown
  }
  extra?: unknown
  breadcrumbs?: Array<{ data?: Record<string, unknown> } | null>
}

function stripQuery(url?: string): string | undefined {
  return url ? url.split("?")[0] : url
}

export function scrubEvent<T>(event: T): T {
  const e = event as unknown as ScrubbableEvent
  if (e.request) {
    delete e.request.data
    delete e.request.cookies
    if (e.request.headers) {
      delete e.request.headers.cookie
      delete e.request.headers.authorization
    }
    e.request.url = stripQuery(e.request.url)
    delete e.request.query_string
  }
  delete e.extra
  if (Array.isArray(e.breadcrumbs)) {
    for (const b of e.breadcrumbs) {
      if (b?.data && typeof b.data.url === "string") b.data.url = stripQuery(b.data.url)
    }
  }
  return event
}

export function scrubBreadcrumb<T>(breadcrumb: T): T {
  const b = breadcrumb as unknown as { data?: Record<string, unknown> }
  if (b?.data && typeof b.data.url === "string") b.data.url = stripQuery(b.data.url)
  return breadcrumb
}
