"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Send, Square, Bot, User, AlertCircle, Wrench,
  Copy, Check, Pencil, RefreshCw, X,
} from "lucide-react"

// ─── Runtime helpers ────────────────────────────────────────────────────────────
// The SDK parts are typed generically; we use runtime checks against the
// actual string shapes emitted by the server.

type AnyPart = { type: string; [key: string]: unknown }

function getMessageText(parts: AnyPart[] | undefined): string {
  if (!parts) return ""
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("")
}

// Matches both "tool-invocation" (legacy shape) and "dynamic-tool" (v6 shape)
function getActiveToolName(parts: AnyPart[] | undefined): string | undefined {
  if (!parts) return undefined
  for (const p of parts) {
    if (p.type === "tool-invocation") {
      const inv = p.toolInvocation as { toolName?: string; state?: string } | undefined
      if (inv?.state === "call" || inv?.state === "partial-call") return inv.toolName
    }
    if (p.type === "dynamic-tool") {
      if (p.state === "call" || p.state === "partial-call") return p.toolName as string
    }
  }
  return undefined
}

function formatToolName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()
}

function autoResize(el: HTMLTextAreaElement | null, maxPx = 200) {
  if (!el) return
  el.style.height = "auto"
  el.style.height = Math.min(el.scrollHeight, maxPx) + "px"
}

// ─── Sub-component: ghost icon button ──────────────────────────────────────────

function ActionBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1 rounded text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all"
    >
      {children}
    </button>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function ChatWindow() {
  const [input, setInput]         = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText]   = useState("")
  const [copiedId, setCopiedId]   = useState<string | null>(null)

  const messagesEndRef  = useRef<HTMLDivElement>(null)
  const textareaRef     = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    sendMessage,
    stop,
    regenerate,
    setMessages,
    status,
    error,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => console.error("[v0] Chat error:", err),
  })

  const isActive       = status === "streaming" || status === "submitted"
  const isReady        = status === "ready"
  const lastMsg        = messages.at(-1)
  const showRegenerate = isReady && !error && lastMsg?.role === "assistant"

  // Find the active tool across all parts of the last assistant message
  const activeToolName = isActive
    ? getActiveToolName(
        (lastMsg?.role === "assistant" ? lastMsg.parts : undefined) as AnyPart[] | undefined
      )
    : undefined

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isActive])

  useEffect(() => {
    if (editingId && editTextareaRef.current) {
      autoResize(editTextareaRef.current)
      editTextareaRef.current.focus()
      const len = editTextareaRef.current.value.length
      editTextareaRef.current.setSelectionRange(len, len)
    }
  }, [editingId])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!input.trim() || isActive) return
    sendMessage({ text: input })
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
    } catch { /* clipboard permission denied */ }
  }

  const startEdit = (id: string, text: string) => {
    setEditingId(id)
    setEditText(text)
  }

  const cancelEdit = () => { setEditingId(null); setEditText("") }

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return
    const idx = messages.findIndex((m) => m.id === editingId)
    if (idx === -1) { cancelEdit(); return }

    // Slice to the edited user message (dropping all assistant turns after it)
    // and patch its text part
    setMessages(
      messages.slice(0, idx + 1).map((m, i) => {
        if (i !== idx) return m
        return {
          ...m,
          parts: (m.parts as AnyPart[]).map((p) =>
            p.type === "text" ? { ...p, text: editText } : p
          ),
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
    )
    regenerate()
    cancelEdit()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
          <Bot className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">Powered by Gemini 2.5 Flash</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            isActive ? "bg-accent animate-pulse" : error ? "bg-red-500" : "bg-green-500"
          }`} />
          <span className="text-xs text-muted-foreground">
            {isActive ? "Thinking..." : error ? "Error" : "Online"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Command Center Ready</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ask me anything about your projects, code, or let me help with tasks.
            </p>
          </div>
        )}

        {/* Message rows */}
        {messages.map((message) => {
          const text      = getMessageText(message.parts as AnyPart[])
          if (!text) return null
          const isUser    = message.role === "user"
          const isEditing = editingId === message.id
          const isCopied  = copiedId  === message.id

          return (
            <div
              key={message.id}
              className={`group flex gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                isUser ? "bg-accent" : "bg-muted"
              }`}>
                {isUser
                  ? <User className="w-4 h-4 text-accent-foreground" />
                  : <Bot  className="w-4 h-4 text-accent" />
                }
              </div>

              {/* Bubble + action strip */}
              <div className={`flex flex-col gap-1.5 min-w-0 max-w-[80%] ${
                isUser ? "items-end" : "items-start"
              }`}>

                {isEditing ? (
                  /* ── Edit mode ── */
                  <div className="w-full space-y-2">
                    <textarea
                      ref={editTextareaRef}
                      value={editText}
                      rows={1}
                      onChange={(e) => { setEditText(e.target.value); autoResize(e.target) }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit() }
                        if (e.key === "Escape") cancelEdit()
                      }}
                      className="w-full px-3 py-2 bg-background border border-accent rounded-lg text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 overflow-y-auto"
                      style={{ maxHeight: "200px" }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={!editText.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-all"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Save &amp; Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal bubble ── */
                  <>
                    <div className={`px-4 py-2.5 rounded-lg text-sm whitespace-pre-wrap break-words ${
                      isUser
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-foreground"
                    }`}>
                      {text}
                    </div>

                    {/* Hover action icons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ActionBtn
                        title={isCopied ? "Copied!" : "Copy message"}
                        onClick={() => handleCopy(text, message.id)}
                      >
                        {isCopied
                          ? <Check   className="w-3.5 h-3.5 text-green-400" />
                          : <Copy    className="w-3.5 h-3.5" />
                        }
                      </ActionBtn>
                      {isUser && !isActive && (
                        <ActionBtn
                          title="Edit message"
                          onClick={() => startEdit(message.id, text)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </ActionBtn>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">Failed to send message. Please try again.</p>
          </div>
        )}

        {/* Thinking / Tool indicator */}
        {isActive && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted min-w-0">
              {/* Pulsing dot */}
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              {activeToolName ? (
                <span className="flex items-center gap-1.5 text-xs min-w-0">
                  <Wrench className="w-3 h-3 flex-shrink-0 text-accent" />
                  <span className="text-muted-foreground flex-shrink-0">Action:</span>
                  <span className="text-accent font-medium truncate">
                    {formatToolName(activeToolName)}…
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Assistant is processing…
                </span>
              )}
            </div>
          </div>
        )}

        {/* Regenerate button — shown after last assistant message when idle */}
        {showRegenerate && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => regenerate()}
              className="flex items-center gap-2 px-4 py-2 text-xs rounded-lg border border-border text-muted-foreground hover:text-accent hover:border-accent/50 hover:bg-accent/5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate response
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
        className="p-4 border-t border-border bg-muted/30"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
            onKeyDown={handleKeyDown}
            placeholder={
              isActive
                ? "Waiting for response…"
                : "Message… (Enter to send · Shift+Enter for new line)"
            }
            disabled={isActive}
            className="flex-1 min-w-0 px-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-60 resize-none overflow-y-auto leading-relaxed"
            style={{ maxHeight: "200px" }}
          />

          {/* Stop — shown while AI is active */}
          {isActive ? (
            <button
              type="button"
              onClick={() => stop()}
              title="Stop generation"
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-accent bg-transparent text-accent hover:bg-red-500/10 hover:border-red-400 hover:text-red-400 transition-all focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            /* Send — shown when ready */
            <button
              type="submit"
              disabled={!input.trim() || !isReady}
              title="Send message"
              className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
