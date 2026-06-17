"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

const TIMEOUT_MS = 30 * 60 * 1000  // 30 minutes
const WARN_MS = 25 * 60 * 1000     // warn at 25 minutes
const CHECK_INTERVAL = 30_000       // check every 30 seconds
const STORAGE_KEY = "claima_last_activity"

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keypress", "scroll", "touchstart", "click"]

const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/marketplace", "/store", "/baa", "/privacy", "/terms", "/security", "/"]

function isPublicPath(pathname: string) {
  if (pathname === "/") return true
  return PUBLIC_PREFIXES.some((p) => p !== "/" && pathname.startsWith(p))
}

export default function SessionTimeout() {
  const router = useRouter()
  const pathname = usePathname()
  const [showWarning, setShowWarning] = useState(false)
  const warningShown = useRef(false)

  useEffect(() => {
    if (isPublicPath(pathname)) return

    function stamp() {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    }

    // Record activity
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, stamp, { passive: true }))
    stamp()

    const interval = setInterval(async () => {
      const last = parseInt(localStorage.getItem(STORAGE_KEY) ?? "0")
      const idle = Date.now() - last

      if (idle >= TIMEOUT_MS) {
        clearInterval(interval)
        await fetch("/api/auth/logout", { method: "POST" })
        router.push("/login?timeout=1")
      } else if (idle >= WARN_MS && !warningShown.current) {
        warningShown.current = true
        setShowWarning(true)
      } else if (idle < WARN_MS && warningShown.current) {
        warningShown.current = false
        setShowWarning(false)
      }
    }, CHECK_INTERVAL)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, stamp))
      clearInterval(interval)
    }
  }, [pathname, router])

  if (!showWarning) return null

  function keepAlive() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    warningShown.current = false
    setShowWarning(false)
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Session expiring soon</h2>
        <p className="text-sm text-gray-500 mb-6">
          You&apos;ve been inactive for 25 minutes. For HIPAA compliance, you&apos;ll be automatically signed out in 5 minutes.
        </p>
        <button
          onClick={keepAlive}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
        >
          Keep me signed in
        </button>
      </div>
    </div>
  )
}
