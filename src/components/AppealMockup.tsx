"use client"

import { useState, useEffect } from "react"

const APPEAL = "We are writing to appeal the denial of claim #2841 (CARC 197). Per Aetna Policy CP.MP.116, psychiatric services under an established treatment plan do not require prior authorization when the treating provider has documented medical necessity and the services are part of a continuing course of treatment. Enclosed is the signed treatment plan and progress notes confirming medical necessity."

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export default function AppealMockup() {
  const [text, setText]           = useState("")
  const [showButton, setShowBtn]  = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      while (!cancelled) {
        setText(""); setShowBtn(false)
        await sleep(1200)

        for (let i = 1; i <= APPEAL.length; i++) {
          if (cancelled) return
          setText(APPEAL.slice(0, i))
          await sleep(14)
        }

        await sleep(400)
        if (!cancelled) setShowBtn(true)
        await sleep(4500)
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  const typing = text.length > 0 && text.length < APPEAL.length

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-[11px]">
      {/* Denial header */}
      <div className="bg-red-50 border-b border-red-100 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-red-900">Denial — Claim #2841</span>
          <span className="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">DENIED</span>
        </div>
        <div className="text-red-700">CARC 197 — Authorization required</div>
        <div className="text-red-500 text-[10px] mt-0.5">$1,840 · Aetna · Dr. Chen</div>
      </div>

      {/* Appeal being generated */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">AI-Generated Appeal</div>
          {typing && (
            <span className="text-[8px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full animate-pulse">
              Writing…
            </span>
          )}
        </div>
        <div className="space-y-1 text-[10px] leading-relaxed">
          <div className="font-medium text-gray-800">Re: Appeal of Claim #2841</div>
          <div className="text-gray-500">Dear Aetna Appeals Department,</div>
          <div className="text-gray-500 min-h-[64px]">
            {text}
            <span className={`inline-block w-0.5 h-[10px] bg-gray-500 ml-0.5 align-middle ${typing ? "animate-pulse" : "opacity-0"}`} />
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-gray-50 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">
          {showButton ? "Ready to send" : typing ? "Generating…" : "Starting…"}
        </span>
        <button className={`text-[10px] font-semibold bg-blue-600 text-white px-2.5 py-1 rounded-md transition-opacity duration-500 ${showButton ? "opacity-100" : "opacity-40 cursor-not-allowed"}`}>
          Send Appeal
        </button>
      </div>
    </div>
  )
}
