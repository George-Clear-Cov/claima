"use client"

import { useState, useEffect, useRef } from "react"
import AppLayout from "@/components/AppLayout"

interface Message {
  role: "user" | "assistant"
  content: string
}

const QUICK_PROMPTS = [
  "What's my current denial rate and what's driving it?",
  "Which open denials should I work first?",
  "How do I appeal a CARC-197 prior authorization denial?",
  "What's my outstanding patient balance and collection rate?",
  "Explain the difference between CARC-4 and CARC-50 denials",
  "How do I bill telehealth sessions correctly?",
]

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm">
          C
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
        }`}
      >
        {msg.content}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0 mt-0.5">
          U
        </div>
      )}
    </div>
  )
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch("/api/context")
      .then((r) => r.json())
      .then((d) => setPracticeId(d?.practice?.id ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || streaming) return
    setError(null)

    const userMsg: Message = { role: "user", content: text.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput("")
    setStreaming(true)

    const assistantMsg: Message = { role: "assistant", content: "" }
    setMessages((prev) => [...prev, assistantMsg])

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          practiceId,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || "Assistant unavailable")
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "assistant", content: accumulated }
          return updated
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <AppLayout>
      <div className="flex flex-col h-full max-w-3xl w-full mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold text-white shadow-sm">
              C
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Claima AI</h1>
              <p className="text-xs text-gray-500">Billing assistant with live practice data</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-500">Live</span>
            </div>
          </div>
        </div>

        {/* Message area */}
        <div className="flex-1 flex flex-col">
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-2xl font-bold text-white shadow-md mb-5">
                C
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">What can I help with?</h2>
              <p className="text-gray-500 text-sm text-center max-w-sm mb-8">
                I have access to your practice billing data — ask me about denials, collections, or specific claims.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => send(prompt)}
                    disabled={streaming}
                    className="text-left text-xs text-gray-700 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 rounded-xl px-4 py-3 transition-all shadow-sm hover:shadow-md"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4 pb-4 overflow-y-auto">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {streaming && messages[messages.length - 1]?.content === "" && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm">
                    C
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        {/* Input */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about denials, claims, collections, billing rules…"
            disabled={streaming}
            rows={1}
            className="w-full px-4 pt-3.5 pb-2 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none disabled:opacity-50 bg-transparent leading-relaxed"
            style={{ minHeight: "52px", maxHeight: "160px" }}
          />
          <div className="px-4 pb-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">Enter to send · Shift+Enter for new line</span>
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-[0.98]"
            >
              {streaming ? "…" : "Send →"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-3">
          Powered by Claude · Not a substitute for a licensed billing specialist
        </p>
      </div>
    </AppLayout>
  )
}
