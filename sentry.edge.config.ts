import * as Sentry from "@sentry/nextjs"
import { scrubEvent, scrubBreadcrumb } from "./sentry.scrub"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
})
