import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
  // Strip PHI from error context — only keep route/method/status
  beforeSend(event) {
    if (event.request?.data) delete event.request.data
    if (event.request?.cookies) delete event.request.cookies
    if (event.request?.headers?.cookie) delete event.request.headers.cookie
    return event
  },
})
