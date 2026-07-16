"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { LogoMark } from "@/components/Logo"

type View = "loading" | "off" | "setup" | "on"

export default function SecuritySettingsPage() {
  const [view, setView] = useState<View>("loading")
  const [backupRemaining, setBackupRemaining] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // enrollment
  const [secret, setSecret] = useState("")
  const [otpUri, setOtpUri] = useState("")
  const [code, setCode] = useState("")
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null)

  // disable
  const [disableCode, setDisableCode] = useState("")

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/mfa/status")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load")
      setBackupRemaining(data.backupCodesRemaining ?? 0)
      setView(data.enabled ? "on" : "off")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
      setView("off")
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  async function startSetup() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Setup failed")
      setSecret(data.secret)
      setOtpUri(data.otpauthUri)
      setCode("")
      setView("setup")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not enable")
      setNewBackupCodes(data.backupCodes ?? [])
      setView("on")
      setBackupRemaining((data.backupCodes ?? []).length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable")
    } finally {
      setBusy(false)
    }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Could not disable")
      setDisableCode("")
      setNewBackupCodes(null)
      setView("off")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable")
    } finally {
      setBusy(false)
    }
  }

  const groupedSecret = secret.replace(/(.{4})/g, "$1 ").trim()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 h-14 flex items-center justify-between">
        <Link href="/settings" className="flex items-center gap-2.5">
          <LogoMark size={28} />
          <span className="font-semibold text-sm text-gray-900">Claima</span>
        </Link>
        <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-700">← Settings</Link>
      </header>

      <main className="max-w-xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Two-factor authentication</h1>
        <p className="text-gray-500 text-sm mb-8">
          Add a second step to email/password sign-in using an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm mb-6 flex items-center gap-2">
            <span className="text-red-500 shrink-0">⚠</span>{error}
          </div>
        )}

        {/* Freshly-generated backup codes (shown once) */}
        {newBackupCodes && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-amber-900 mb-2">Save your backup codes</h2>
            <p className="text-amber-800 text-xs mb-4">
              Each code works once if you lose your authenticator. Store them somewhere safe — they won&apos;t be shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm text-gray-800 bg-white border border-amber-200 rounded-xl p-4">
              {newBackupCodes.map((c) => <div key={c}>{c}</div>)}
            </div>
            <button
              onClick={() => {
                const blob = new Blob([newBackupCodes.join("\n")], { type: "text/plain" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url; a.download = "claima-backup-codes.txt"; a.click()
                URL.revokeObjectURL(url)
              }}
              className="mt-4 text-sm text-amber-800 font-medium hover:text-amber-900 underline"
            >
              Download codes
            </button>
          </div>
        )}

        {view === "loading" && <div className="text-gray-400 text-sm">Loading…</div>}

        {view === "off" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="text-sm font-medium text-gray-900">Two-factor authentication is off</span>
            </div>
            <p className="text-gray-500 text-sm mb-5">We strongly recommend enabling it for HIPAA-grade account protection.</p>
            <button
              onClick={startSetup}
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
            >
              {busy ? "Starting…" : "Enable two-factor"}
            </button>
          </div>
        )}

        {view === "setup" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">1. Add Claima to your authenticator app</h2>
            <p className="text-gray-500 text-sm mb-3">Enter this setup key manually:</p>
            <div className="font-mono text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-2 tracking-wider break-all">
              {groupedSecret}
            </div>
            <a href={otpUri} className="text-xs text-blue-600 hover:underline">Or tap here to open your authenticator app →</a>

            <h2 className="text-sm font-semibold text-gray-900 mt-6 mb-3">2. Enter the 6-digit code it shows</h2>
            <form onSubmit={confirmEnable} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-lg text-gray-900 tracking-[0.3em] text-center focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder-gray-300"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || code.trim().length < 6}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition-all"
                >
                  {busy ? "Verifying…" : "Verify & enable"}
                </button>
                <button type="button" onClick={() => { setView("off"); setError(null) }} className="px-4 text-gray-500 hover:text-gray-700 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {view === "on" && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-900">Two-factor authentication is on</span>
            </div>
            <p className="text-gray-500 text-sm mb-5">{backupRemaining} backup code{backupRemaining === 1 ? "" : "s"} remaining.</p>
            <form onSubmit={disable} className="border-t border-gray-100 pt-5">
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">Disable — enter a current code to confirm</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder="123456 or backup code"
                  className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/10 placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={busy || disableCode.trim().length < 6}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                >
                  {busy ? "…" : "Disable"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
