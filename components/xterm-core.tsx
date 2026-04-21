"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import type { TerminalHandle } from "./dashboard-terminal"

// ── Echo helpers ────────────────────────────────────────────────────────────
const PROMPT = "\x1b[36m❯\x1b[0m "

function writePrompt(term: { write: (s: string) => void }) {
  term.write(PROMPT)
}

// ── Component ────────────────────────────────────────────────────────────────

export const XTermCore = forwardRef<TerminalHandle>(function XTermCore(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef      = useRef<import("@xterm/xterm").Terminal | null>(null)
  const fitRef       = useRef<import("@xterm/addon-fit").FitAddon | null>(null)
  const lineRef      = useRef("")            // current input buffer

  useImperativeHandle(ref, () => ({
    clear() {
      if (!termRef.current) return
      termRef.current.clear()
      writePrompt(termRef.current)
    },
    async copySelection() {
      const sel = termRef.current?.getSelection()
      if (sel) {
        try { await navigator.clipboard.writeText(sel) } catch { /* denied */ }
      }
    },
  }))

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false
    let term: import("@xterm/xterm").Terminal
    let fitAddon: import("@xterm/addon-fit").FitAddon
    let ro: ResizeObserver

    async function init() {
      const { Terminal } = await import("@xterm/xterm")
      const { FitAddon } = await import("@xterm/addon-fit")

      if (disposed || !containerRef.current) return

      term = new Terminal({
        theme: {
          background:        "#0a0a0a",
          foreground:        "#e5e5e5",
          cursor:            "#00d9ff",
          cursorAccent:      "#0a0a0a",
          selectionForeground: "#0a0a0a",
          selectionBackground: "#00d9ff",
          black:             "#1a1a1a",
          brightBlack:       "#404040",
          cyan:              "#00d9ff",
          brightCyan:        "#33e2ff",
          green:             "#4ade80",
          brightGreen:       "#86efac",
          red:               "#f87171",
          brightRed:         "#fca5a5",
          yellow:            "#facc15",
          brightYellow:      "#fde047",
          blue:              "#60a5fa",
          brightBlue:        "#93c5fd",
          magenta:           "#c084fc",
          brightMagenta:     "#d8b4fe",
          white:             "#e5e5e5",
          brightWhite:       "#ffffff",
        },
        fontFamily: '"GeistMono", "Geist Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize:   13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback:  1000,
        allowProposedApi: true,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      fitAddon.fit()

      termRef.current = term
      fitRef.current  = fitAddon

      // ── Welcome banner ───────────────────────────────────────────────────
      term.writeln("\x1b[36m┌─────────────────────────────────────────────────┐\x1b[0m")
      term.writeln("\x1b[36m│\x1b[0m  \x1b[1mSnr-Dave Command Center\x1b[0m — System Console      \x1b[36m│\x1b[0m")
      term.writeln("\x1b[36m│\x1b[0m  Echo mode active. Type to test input/output.    \x1b[36m│\x1b[0m")
      term.writeln("\x1b[36m└─────────────────────────────────────────────────┘\x1b[0m")
      term.writeln("")
      writePrompt(term)

      // ── Input handler ────────────────────────────────────────────────────
      term.onData((data: string) => {
        const code = data.charCodeAt(0)

        if (data === "\r") {
          // Enter — execute / new line
          const cmd = lineRef.current.trim()
          term.writeln("")
          if (cmd) {
            if (cmd === "clear") {
              term.clear()
            } else if (cmd === "help") {
              term.writeln("  \x1b[36mAvailable commands:\x1b[0m clear, help")
            } else {
              // Echo back
              term.writeln(`  \x1b[2mecho:\x1b[0m ${cmd}`)
            }
          }
          lineRef.current = ""
          writePrompt(term)

        } else if (data === "\x7f" || code === 8) {
          // Backspace
          if (lineRef.current.length > 0) {
            lineRef.current = lineRef.current.slice(0, -1)
            term.write("\b \b")
          }

        } else if (code >= 32) {
          // Printable character
          lineRef.current += data
          term.write(data)
        }
      })

      // ── Resize observer ──────────────────────────────────────────────────
      ro = new ResizeObserver(() => {
        try { fitAddon.fit() } catch { /* ignore race during unmount */ }
      })
      ro.observe(containerRef.current!)
    }

    init()

    return () => {
      disposed = true
      ro?.disconnect()
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
