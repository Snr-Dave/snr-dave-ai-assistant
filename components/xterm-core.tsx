"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import type { TerminalHandle } from "./dashboard-terminal"

// ── Component ────────────────────────────────────────────────────────────────

export const XTermCore = forwardRef<TerminalHandle>(function XTermCore(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef   = useRef<import("@xterm/xterm").Terminal | null>(null)
  const fitRef    = useRef<import("@xterm/addon-fit").FitAddon | null>(null)
  const socketRef = useRef<import("socket.io-client").Socket | null>(null)

  // ── Exposed handles (Clear / Copy / FontSize) ────────────────────────────
  useImperativeHandle(ref, () => ({
    clear() {
      // Clear xterm's visual buffer and ask bash to redraw the prompt (Ctrl+L)
      termRef.current?.clear()
      socketRef.current?.emit("input", "\x0c")
    },
    async copySelection() {
      const sel = termRef.current?.getSelection()
      if (sel) {
        try { await navigator.clipboard.writeText(sel) } catch { /* denied */ }
      }
    },
    setFontSize(n: number) {
      if (!termRef.current) return
      termRef.current.options.fontSize = n
      // Allow one microtask for xterm to apply the change, then refit
      requestAnimationFrame(() => {
        try { fitRef.current?.fit() } catch { /* ignore */ }
      })
    },
  }))

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false
    let term: import("@xterm/xterm").Terminal
    let fitAddon: import("@xterm/addon-fit").FitAddon
    let socket: import("socket.io-client").Socket
    let ro: ResizeObserver

    async function init() {
      // Lazy-load client-only modules
      const { Terminal } = await import("@xterm/xterm")
      const { FitAddon } = await import("@xterm/addon-fit")
      const { io }       = await import("socket.io-client")

      if (disposed || !containerRef.current) return

      // ── xterm setup ───────────────────────────────────────────────────────
      term = new Terminal({
        theme: {
          background:          "#0a0a0a",
          foreground:          "#e5e5e5",
          cursor:              "#00d9ff",
          cursorAccent:        "#0a0a0a",
          selectionForeground: "#0a0a0a",
          selectionBackground: "#00d9ff",
          black:               "#1a1a1a",
          brightBlack:         "#404040",
          cyan:                "#00d9ff",
          brightCyan:          "#33e2ff",
          green:               "#4ade80",
          brightGreen:         "#86efac",
          red:                 "#f87171",
          brightRed:           "#fca5a5",
          yellow:              "#facc15",
          brightYellow:        "#fde047",
          blue:                "#60a5fa",
          brightBlue:          "#93c5fd",
          magenta:             "#c084fc",
          brightMagenta:       "#d8b4fe",
          white:               "#e5e5e5",
          brightWhite:         "#ffffff",
        },
        fontFamily:      '"GeistMono", "Geist Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize:        13,
        lineHeight:      1.4,
        cursorBlink:     true,
        cursorStyle:     "block",
        scrollback:      2000,
        allowProposedApi: true,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      fitAddon.fit()

      termRef.current = term
      fitRef.current  = fitAddon

      // ── Connecting banner ─────────────────────────────────────────────────
      term.writeln("\x1b[36m┌──────────────────────────────────────────────────┐\x1b[0m")
      term.writeln("\x1b[36m│\x1b[0m  \x1b[1mSnr-Dave Command Center\x1b[0m — System Console       \x1b[36m│\x1b[0m")
      term.writeln("\x1b[36m│\x1b[0m  Connecting to shell bridge…                      \x1b[36m│\x1b[0m")
      term.writeln("\x1b[36m└──────────────────────────────────────────────────┘\x1b[0m")
      term.writeln("")

      // ── Initialise Socket.IO server (lazy, idempotent) ────────────────────
      try {
        await fetch("/api/terminal/shell")
      } catch (err) {
        term.writeln(`\x1b[31mFailed to reach shell API: ${String(err)}\x1b[0m\r\n`)
        return
      }

      if (disposed) return

      // ── Connect socket.io client ──────────────────────────────────────────
      socket = io({
        path:       "/api/terminal/socket.io",
        transports: ["websocket", "polling"],
      })
      socketRef.current = socket

      socket.on("connect", () => {
        term.writeln("\x1b[32m✓ Shell connected\x1b[0m\r\n")
      })

      socket.on("output", (data: string) => {
        term.write(data)
      })

      socket.on("exit", (code: number) => {
        term.writeln(`\r\n\x1b[33mShell exited (code ${code}). Refresh to reconnect.\x1b[0m`)
      })

      socket.on("connect_error", (err: Error) => {
        term.writeln(`\r\n\x1b[31mConnection error: ${err.message}\x1b[0m`)
      })

      // ── Pipe xterm input → socket → bash stdin ────────────────────────────
      term.onData((data: string) => {
        socket.emit("input", data)
      })

      // ── Resize observer ───────────────────────────────────────────────────
      ro = new ResizeObserver(() => {
        try { fitAddon.fit() } catch { /* ignore race during unmount */ }
      })
      ro.observe(containerRef.current!)
    }

    init()

    return () => {
      disposed = true
      ro?.disconnect()
      socketRef.current?.disconnect()
      socketRef.current = null
      term?.dispose()
      termRef.current = null
      fitRef.current  = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#0a0a0a" }}
    />
  )
})
