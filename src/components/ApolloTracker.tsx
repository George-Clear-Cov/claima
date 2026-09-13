"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"

/**
 * Apollo website-visitor tracking.
 *
 * WHY IT IS NOT ON EVERY PAGE, WHICH IS WHAT APOLLO ASKS FOR
 * /leak-report tells the visitor, in print: "open your browser network tab before dropping the
 * file and you will see no request." A tracker that beacons on page load puts requests in that
 * log before they ever drop a file, and the sentence stops being true. The zero-network
 * guarantee is the most differentiated thing on the site, and no competitor has a free
 * diagnostic that touches claims data at all. Trading it for attribution on one route is a bad
 * deal, so that route stays dark and every other route is tracked.
 *
 * Nothing here identifies a patient or reads an uploaded file. It resolves the visiting
 * company from network information so we can tell whether a practice we emailed actually read
 * its own page, which is the entire reason the per-practice pages exist.
 */

const APP_ID = "689a048953863500159f3369"

/** Routes that must produce no network traffic of their own. */
const UNTRACKED = ["/leak-report"]

export default function ApolloTracker() {
  const pathname = usePathname()

  if (process.env.NODE_ENV !== "production") return null
  if (UNTRACKED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null

  return (
    <Script
      id="apollo-website-tracker"
      strategy="afterInteractive"
      // next/script dedupes by id, so this cannot double-fire on client navigation.
      dangerouslySetInnerHTML={{
        __html: `
          (function () {
            if (window.__apolloTrackerLoaded) return;
            window.__apolloTrackerLoaded = true;
            var n = Math.random().toString(36).substring(7);
            var o = document.createElement("script");
            o.src = "https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache=" + n;
            o.async = true;
            o.defer = true;
            o.onload = function () {
              if (window.trackingFunctions && window.trackingFunctions.onLoad) {
                window.trackingFunctions.onLoad({ appId: "${APP_ID}" });
              }
            };
            document.head.appendChild(o);
          })();
        `,
      }}
    />
  )
}
