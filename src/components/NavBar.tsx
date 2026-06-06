"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface Session {
  name: string
  email: string
  role: string
}

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/claims", label: "Claims" },
  { href: "/denials", label: "Denials" },
  { href: "/eligibility", label: "Eligibility" },
  { href: "/billing", label: "Billing" },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.user ? setSession(d.user) : null)
      .catch(() => null)
  }, [])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="border-b border-gray-800/80 bg-gray-950/95 backdrop-blur-sm px-6 py-0 flex items-center justify-between sticky top-0 z-30 h-14">
      <div className="flex items-center gap-5 h-full">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-900/30">
            M
          </div>
          <span className="font-semibold tracking-tight text-sm text-white">MediBill</span>
        </Link>

        <div className="w-px h-4 bg-gray-800" />

        <nav className="flex items-center gap-0.5 h-full">
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  active
                    ? "text-white bg-gray-800"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-900"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-px bg-blue-500 rounded-full" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {session && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300">
              {session.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-gray-400">{session.name}</span>
          </div>
        )}
        <div className="w-px h-4 bg-gray-800" />
        <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-md hover:bg-gray-900">
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-md hover:bg-gray-900"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
