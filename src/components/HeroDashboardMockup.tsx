"use client"

import { useState, useEffect, useRef } from "react"
import { LogoMark } from "@/components/Logo"

const HEADLINE = "3 denials need appeals — $4,200 at risk"
const SUBTEXT = "CARC 197 on claim #2841 (missing auth), CARC 50 on #2839. Both are winnable — draft letters ready."

const PRIORITIES = [
  { urgency: "red",   label: "Immediate", action: "Appeal #2841 — timely filing in 4 days", dollars: "$1,840" },
  { urgency: "amber", label: "Today",     action: "Post Aetna ERA — 12 claims, $6,200",     dollars: "$6,200" },
  { urgency: "blue",  label: "This Week", action: "Verify eligibility for 3 upcoming visits", dollars: "" },
]

const METRIC_TARGETS = [12400, 3, 1, 8100]
const METRIC_META = [
  { label: "Payments In", color: "text-green-700", accent: "bg-green-500" },
  { label: "New Denials", color: "text-red-700",   accent: "bg-red-500"   },
  { label: "Timely Risk", color: "text-red-700",   accent: "bg-red-500"   },
  { label: "Overdue AR",  color: "text-amber-700", accent: "bg-amber-500" },
]

function fmt(idx: number, v: number) {
  return idx === 0 || idx === 3 ? `$${(v / 1000).toFixed(1)}k` : String(v)
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export default function HeroDashboardMockup() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  const [headline, setHeadline] = useState("")
  const [showSub, setShowSub]   = useState(false)
  const [visible, setVisible]   = useState(0)
  const [metrics, setMetrics]   = useState([0, 0, 0, 0])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) {
      setHeadline(""); setShowSub(false); setVisible(0); setMetrics([0, 0, 0, 0])
      return
    }

    let cancelled = false

    async function run() {
      while (!cancelled) {
        setHeadline(""); setShowSub(false); setVisible(0); setMetrics([0, 0, 0, 0])
        await sleep(500)

        for (let i = 1; i <= HEADLINE.length; i++) {
          if (cancelled) return
          setHeadline(HEADLINE.slice(0, i))
          await sleep(38)
        }
        await sleep(180)
        if (!cancelled) setShowSub(true)

        for (let i = 1; i <= PRIORITIES.length; i++) {
          if (cancelled) return
          await sleep(360)
          setVisible(i)
        }

        await sleep(250)
        const start = Date.now()
        const dur = 1200
        await new Promise<void>(resolve => {
          function tick() {
            if (cancelled) { resolve(); return }
            const p = Math.min((Date.now() - start) / dur, 1)
            const e = 1 - Math.pow(1 - p, 3)
            setMetrics(METRIC_TARGETS.map(t => Math.round(t * e)))
            if (p < 1) requestAnimationFrame(tick); else resolve()
          }
          requestAnimationFrame(tick)
        })

        await sleep(5000)
      }
    }

    run()
    return () => { cancelled = true }
  }, [inView])

  return (
    <div ref={ref} className="rounded-xl overflow-hidden border border-gray-200 shadow-2xl ring-1 ring-black/5">
      {/* Browser chrome */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded px-3 py-0.5 text-[11px] text-gray-400 ml-2 border border-gray-200">
          app.claima.io
        </div>
      </div>

      {/* App */}
      <div className="bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-3 h-9 flex items-center gap-3">
          <LogoMark size={18} />
          <span className="text-[11px] font-semibold text-gray-900">Claima</span>
          <div className="w-px h-3 bg-gray-200" />
          {["Dashboard", "Claims", "Denials", "Billing"].map(l => (
            <span key={l} className={`text-[11px] px-2 py-0.5 rounded ${l === "Dashboard" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-400"}`}>{l}</span>
          ))}
        </div>

        <div className="p-3 space-y-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5" style={{ minHeight: 76 }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <LogoMark size={14} />
              <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">AI Briefing</span>
            </div>
            <div className="text-[11px] font-bold text-amber-900 mb-1 min-h-[16px]">
              {headline}
              <span className={`inline-block w-0.5 h-[11px] bg-amber-800 ml-0.5 align-middle ${headline.length < HEADLINE.length && headline.length > 0 ? "animate-pulse" : "opacity-0"}`} />
            </div>
            <div className={`text-[10px] text-amber-700 leading-relaxed transition-opacity duration-400 ${showSub ? "opacity-100" : "opacity-0"}`}>
              {SUBTEXT}
            </div>
          </div>

          <div className="space-y-1" style={{ minHeight: 90 }}>
            {PRIORITIES.map((p, i) => (
              <div
                key={p.action}
                className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-2 transition-all duration-300 ${
                  i < visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                } ${
                  p.urgency === "red"   ? "bg-red-50 border-red-200" :
                  p.urgency === "amber" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"
                }`}
              >
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  p.urgency === "red"   ? "bg-red-100 text-red-700" :
                  p.urgency === "amber" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                }`}>{p.label}</span>
                <span className={`text-[10px] font-medium flex-1 ${
                  p.urgency === "red" ? "text-red-800" :
                  p.urgency === "amber" ? "text-amber-800" : "text-blue-800"
                }`}>{p.action}</span>
                {p.dollars && (
                  <span className={`text-[10px] font-mono font-bold shrink-0 ${
                    p.urgency === "red" ? "text-red-700" :
                    p.urgency === "amber" ? "text-amber-700" : "text-blue-700"
                  }`}>{p.dollars}</span>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {METRIC_META.map((m, i) => (
              <div key={m.label} className="bg-white border border-gray-200 rounded-lg p-2 relative overflow-hidden">
                <div className={`absolute inset-x-0 top-0 h-0.5 ${m.accent}`} />
                <div className="text-[8px] text-gray-400 uppercase tracking-wide mb-0.5">{m.label}</div>
                <div className={`text-sm font-bold font-mono tabular-nums ${m.color}`}>
                  {fmt(i, metrics[i])}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
