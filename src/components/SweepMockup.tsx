"use client"

import { useState, useEffect } from "react"

const TASKS = [
  { text: "ERA posted — Cigna 11/14",      sub: "$8,400 applied"    },
  { text: "3 appeal letters drafted",       sub: "Ready to send"    },
  { text: "Timely filing alerts sent",      sub: "2 claims flagged" },
  { text: "Eligibility checks",             sub: "8 visits pending" },
  { text: "Aging AR review",               sub: "In queue"         },
]
const DONE_AT = 3

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export default function SweepMockup() {
  const [checked, setChecked] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function run() {
      while (!cancelled) {
        setChecked(0)
        await sleep(1000)
        for (let i = 1; i <= DONE_AT; i++) {
          if (cancelled) return
          await sleep(850)
          setChecked(i)
        }
        await sleep(4500)
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  const pct = Math.round((checked / TASKS.length) * 100)

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-semibold text-gray-700">Daily Sweep</span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
          checked >= DONE_AT
            ? "text-green-700 bg-green-50 border-green-200"
            : "text-blue-600 bg-blue-50 border-blue-100"
        }`}>
          {checked >= DONE_AT ? "Complete" : "Running"}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {TASKS.map((task, i) => {
          const done = i < checked
          return (
            <div key={task.text} className="flex items-start gap-2.5">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-300 ${done ? "bg-green-100" : "bg-gray-100"}`}>
                {done ? (
                  <svg className="w-2.5 h-2.5 text-green-600 tick-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                )}
              </div>
              <div>
                <div className={`text-xs font-medium transition-colors duration-300 ${done ? "text-gray-700" : "text-gray-400"}`}>{task.text}</div>
                <div className={`text-[10px] transition-colors duration-300 ${done ? "text-gray-400" : "text-gray-300"}`}>{task.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
        <span className="text-[10px] text-gray-400 shrink-0">{checked} of {TASKS.length} tasks</span>
        <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
          <div
            className="bg-blue-500 h-1 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-blue-600 shrink-0">{pct}%</span>
      </div>
    </div>
  )
}
