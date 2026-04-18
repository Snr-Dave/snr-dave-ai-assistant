"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Send, Square, Bot, User, AlertCircle, Wrench } from "lucide-react"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
}

type ToolInvocationPart = {
  type: "tool-invocation"
  toolInvocation: {
    toolCallId: string
    toolName: string
    state: "call" | "partial-call" | "result"
    args?: unknown
    result?: unknown
  }
}

function getActiveToolName(
  messages: Array<{ role: string; parts?: Array<{ type: string }> }>
): string | undefined {
  const last = messages.at(-1)
  if (!last || last.role !== "assistant") return undefined
  const toolPart = (last.parts ?? [])
    .filter((p): p is ToolInvocationPart => p.type === "tool-invocation")
    .find((p) => p.toolInvocation.state === "call" || p.toolInvocation.state === "partial-call")
  return toolPart?.toolInvocation.toolName
}

// Nicely format a camelCase tool name for display
function formatToolName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ChatWindow() {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, stop, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => {
      console.error("[v0] Chat error:", err)
    },
  })

  const isStreaming  = status === "streaming"
  const isSubmitted  = status === "submitted"
  const isActive     = isStreaming || isSubmitted  // AI is working
  const isReady      = status === "ready"

  const activeToolName = isActive ? getActiveToolName(messages) : undefined

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isActive) return
    console.log("[v0] Sending message:", input)
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
          <Bot className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">Powered by Gemini 2.5 Flash</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isActive ? "bg-accent animate-pulse" : error ? "bg-red-500" : "bg-green-500"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {isActive ? "Thinking..." : error ? "Error" : "Online"}
          </span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Command Center Ready</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ask me anything about your projects, code, or let me help with tasks.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const text = getMessageText(message)
            if (!text) return null
            return (
              <div
                key={message.id}
                className={`flex gap-3 animate-fade-in ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === "user" ? "bg-accent" : "bg-muted"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4 text-accent-foreground" />
                  ) : (
                    <Bot className="w-4 h-4 text-accent" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{text}</p>
                </div>
              </div>
            )
          })
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">Failed to send message. Please try again.</p>
          </div>
        )}

        {/* ── Thinking / Tool indicator ── */}
        {isActive && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted min-w-0">
              {/* Pulse dot */}
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>

              {activeToolName ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                  <Wrench className="w-3 h-3 flex-shrink-0 text-accent" />
                  <span className="text-accent font-medium">{formatToolName(activeToolName)}</span>
                  <span className="hidden sm:inline">— running tool…</span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Assistant is processing…
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isActive ? "Waiting for response…" : "Type a message..."}
            className="flex-1 min-w-0 px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-60"
            disabled={isActive}
          />

          {/* Stop button — visible only while AI is active */}
          {isActive ? (
            <button
              type="button"
              onClick={() => stop()}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-accent bg-transparent text-accent hover:bg-red-500/10 hover:border-red-400 hover:text-red-400 transition-all focus:outline-none focus:ring-2 focus:ring-accent/50"
              aria-label="Stop generation"
              title="Stop generation"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            /* Send button — visible only when ready */
            <button
              type="submit"
              disabled={!input.trim() || !isReady}
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-accent/50"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
