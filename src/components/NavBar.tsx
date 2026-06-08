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
  { href: "/analytics", label: "Analytics" },
  { href: "/assistant", label: "AI Assistant" },
  { href: "/agent", label: "Agent" },
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
    <header className="border-b border-gray-200 bg-white px-6 h-14 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-5 h-full">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            C
          </div>
          <span className="font-semibold tracking-tight text-sm text-gray-900">Claima</span>
        </Link>

        <div className="w-px h-4 bg-gray-200" />

        <nav className="flex items-center gap-0.5 h-full">
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {session && (
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
              {session.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-gray-500">{session.name}</span>
          </div>
        )}
        <div className="w-px h-4 bg-gray-200" />
        <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded-md hover:bg-gray-50">
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
