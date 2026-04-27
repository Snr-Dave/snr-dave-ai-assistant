"use client"

/**
 * Universal GitHub Terminal — hybrid client.
 *
 *   • Uses Socket.IO (WebSocket) when available  → minimal latency on Replit.
 *   • Falls back to HTTP POST `/api/terminal/exec` → reliable on Vercel /
 *     StackBlitz / serverless where WebSocket upgrades are blocked.
 *
 * Each command runs in its own short-lived bash process; the working directory
 * is persisted client-side so `cd` between commands behaves naturally. The
 * connection mode is reported back through the `onStatusChange` callback so
 * the surrounding UI can show a green ("WebSocket") or amber ("HTTP") badge.
 */

import {
  useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback,
} from "react"
import type { Socket } from "socket.io-client"

// ── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "connecting"
  | "websocket"
  | "http"
  | "error"

export interface TerminalHandle {
  clear:         () => void
  copySelection: () => Promise<void>
  setFontSize:   (n: number) => void
}

export interface TerminalProps {
  /** Notifies parent of the active transport so the badge can update. */
  onStatusChange?: (status: ConnectionStatus, detail?: string) => void
  /** Initial CWD; defaults to the workspace root. */
  initialCwd?:     string
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CWD     = "/home/runner/workspace"
const WS_CONNECT_TIMEOUT_MS = 4_000
const PROMPT_COLOR    = "\x1b[1;36m"   // bright cyan
const PROMPT_PATH     = "\x1b[1;34m"   // bright blue
const RESET           = "\x1b[0m"
const DIM             = "\x1b[2m"
const RED             = "\x1b[31m"
const GREEN           = "\x1b[32m"
const YELLOW          = "\x1b[33m"

// Trim long paths in the prompt so the line stays readable.
function shortenPath(path: string, max = 40): string {
  const home = process.env.HOME ?? "/home/runner"
  const display = path.startsWith(home) ? "~" + path.slice(home.length) : path
  if (display.length <= max) return display
  return "…" + display.slice(display.length - max + 1)
}

// ── Component ────────────────────────────────────────────────────────────────

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { onStatusChange, initialCwd = DEFAULT_CWD },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef      = useRef<import("@xterm/xterm").Terminal | null>(null)
  const fitRef       = useRef<import("@xterm/addon-fit").FitAddon | null>(null)
  const socketRef    = useRef<Socket | null>(null)
  const statusRef    = useRef<ConnectionStatus>("connecting")
  const cwdRef       = useRef<string>(initialCwd)

  // Line editor state — we own readline because each "exec" is one shot.
  const inputRef        = useRef<string>("")
  const cursorRef       = useRef<number>(0)
  const historyRef      = useRef<string[]>([])
  const historyIdxRef   = useRef<number>(-1)
  const draftRef        = useRef<string>("")
  const runningIdRef    = useRef<string | null>(null)
  const httpAbortRef    = useRef<AbortController | null>(null)

  const [status, setStatus] = useState<ConnectionStatus>("connecting")

  // ── Public handle ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    clear() {
      termRef.current?.clear()
      writePrompt()
    },
    async copySelection() {
      const sel = termRef.current?.getSelection()
      if (sel) {
        try { await navigator.clipboard.writeText(sel) } catch { /* denied */ }
      }
    },
    setFontSize(n: number) {
      const t = termRef.current
      if (!t) return
      t.options.fontSize = n
      requestAnimationFrame(() => {
        try { fitRef.current?.fit() } catch { /* ignore */ }
      })
    },
  }))

  // ── Helpers — kept as refs so they aren't recreated on every render ──────
  const updateStatus = useCallback((next: ConnectionStatus, detail?: string) => {
    statusRef.current = next
    setStatus(next)
    onStatusChange?.(next, detail)
  }, [onStatusChange])

  const write = useCallback((s: string) => {
    termRef.current?.write(s)
  }, [])

  const writeLn = useCallback((s = "") => {
    termRef.current?.write(s + "\r\n")
  }, [])

  const writePrompt = useCallback(() => {
    const path = shortenPath(cwdRef.current)
    write(`\r\n${PROMPT_COLOR}snr-dave${RESET} ${PROMPT_PATH}${path}${RESET} $ `)
    redrawInput()
  }, [write])

  const redrawInput = useCallback(() => {
    // Move to start of input region, clear from cursor to end of screen, redraw.
    // (Simple impl: rely on terminal echoing — we already tracked input in inputRef.)
    write(inputRef.current)
    // Move cursor back to logical position.
    const tail = inputRef.current.length - cursorRef.current
    if (tail > 0) write(`\x1b[${tail}D`)
  }, [write])

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false
    let term: import("@xterm/xterm").Terminal
    let fitAddon: import("@xterm/addon-fit").FitAddon
    let ro: ResizeObserver | null = null

    async function init() {
      const { Terminal: XTerm } = await import("@xterm/xterm")
      const { FitAddon }        = await import("@xterm/addon-fit")
      if (disposed || !containerRef.current) return

      term = new XTerm({
        theme: {
          background:          "#0a0a0a",
          foreground:          "#e5e5e5",
          cursor:              "#00d9ff",
          cursorAccent:        "#0a0a0a",
          selectionForeground: "#0a0a0a",
          selectionBackground: "#00d9ff",
          black:        "#1a1a1a", brightBlack:   "#404040",
          cyan:         "#00d9ff", brightCyan:    "#33e2ff",
          green:        "#4ade80", brightGreen:   "#86efac",
          red:          "#f87171", brightRed:     "#fca5a5",
          yellow:       "#facc15", brightYellow:  "#fde047",
          blue:         "#60a5fa", brightBlue:    "#93c5fd",
          magenta:      "#c084fc", brightMagenta: "#d8b4fe",
          white:        "#e5e5e5", brightWhite:   "#ffffff",
        },
        fontFamily:       '"GeistMono", "Geist Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize:         13,
        lineHeight:       1.4,
        cursorBlink:      true,
        cursorStyle:      "block",
        scrollback:       5_000,
        convertEol:       false,
        allowProposedApi: true,
      })
      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)
      try { fitAddon.fit() } catch { /* ignore */ }

      termRef.current = term
      fitRef.current  = fitAddon

      // Banner
      writeLn(`${PROMPT_COLOR}┌──────────────────────────────────────────────────┐${RESET}`)
      writeLn(`${PROMPT_COLOR}│${RESET}  ${PROMPT_COLOR}Snr-Dave Universal GitHub Terminal${RESET}              ${PROMPT_COLOR}│${RESET}`)
      writeLn(`${PROMPT_COLOR}│${RESET}  ${DIM}Connecting to shell bridge…${RESET}                     ${PROMPT_COLOR}│${RESET}`)
      writeLn(`${PROMPT_COLOR}└──────────────────────────────────────────────────┘${RESET}`)

      // Wire up input handling.
      term.onData(handleTermInput)

      // Resize observer
      ro = new ResizeObserver(() => {
        try { fitAddon.fit() } catch { /* ignore */ }
      })
      ro.observe(containerRef.current!)

      // Try WebSocket first, fall back to HTTP if it doesn't connect quickly.
      await connectTransport()
      writePrompt()
    }

    async function connectTransport() {
      // Probe the WS bootstrap route first. If it 404s (Vercel App-Router-only
      // deployments), we can short-circuit straight to HTTP fallback.
      try {
        const probe = await fetch("/api/terminal/shell", {
          method: "GET",
          cache:  "no-store",
        })
        if (!probe.ok && probe.status !== 200) {
          throw new Error(`probe returned ${probe.status}`)
        }
      } catch (err) {
        writeLn(`${YELLOW}WebSocket bootstrap unavailable — using HTTP transport${RESET}`)
        useHttpFallback(err instanceof Error ? err.message : String(err))
        return
      }

      const { io } = await import("socket.io-client")
      const socket = io({
        path:               "/api/terminal/socket.io",
        transports:         ["websocket", "polling"],
        timeout:            WS_CONNECT_TIMEOUT_MS,
        reconnection:       true,
        reconnectionDelay:  1_000,
        reconnectionDelayMax: 5_000,
      })
      socketRef.current = socket

      let settled = false
      const settleTimeout = setTimeout(() => {
        if (!settled) {
          settled = true
          try { socket.disconnect() } catch { /* ignore */ }
          writeLn(`${YELLOW}WebSocket handshake timed out — using HTTP transport${RESET}`)
          useHttpFallback("ws timeout")
        }
      }, WS_CONNECT_TIMEOUT_MS)

      socket.on("connect", () => {
        if (settled) return
        settled = true
        clearTimeout(settleTimeout)
        updateStatus("websocket", `socket id ${socket.id}`)
        writeLn(`${GREEN}✓ Shell bridge connected (WebSocket)${RESET}`)
      })

      socket.on("connect_error", (err: Error) => {
        if (settled) return
        settled = true
        clearTimeout(settleTimeout)
        try { socket.disconnect() } catch { /* ignore */ }
        writeLn(`${YELLOW}WebSocket failed (${err.message}) — using HTTP transport${RESET}`)
        useHttpFallback(err.message)
      })

      socket.on("output", (msg: { id: string; stream: "stdout" | "stderr"; data: string }) => {
        if (msg.id !== runningIdRef.current) return
        renderOutput(msg.data, msg.stream === "stderr")
      })

      socket.on("done", (msg: {
        id: string; exitCode: number | null; signal: string | null;
        cwd: string; durationMs: number; truncated: boolean
      }) => {
        if (msg.id !== runningIdRef.current) return
        cwdRef.current = msg.cwd || cwdRef.current
        finishCommand(msg.exitCode, msg.signal, msg.durationMs, msg.truncated)
      })

      socket.on("broadcast", handleBroadcast)

      socket.on("disconnect", (reason: string) => {
        if (statusRef.current === "websocket") {
          writeLn(`${YELLOW}WebSocket disconnected (${reason}). Reconnecting…${RESET}`)
        }
      })
    }

    function useHttpFallback(detail: string) {
      // Tear down any half-open socket so it doesn't keep retrying in the
      // background and emit phantom errors.
      try {
        socketRef.current?.removeAllListeners()
        socketRef.current?.disconnect()
      } catch { /* ignore */ }
      socketRef.current = null
      updateStatus("http", detail)
    }

    function handleBroadcast(event: {
      type:        string
      command?:    string
      data?:       string
      exitCode?:   number | null
      signal?:     string | null
      durationMs?: number
    }) {
      // Only show foreign-origin broadcasts when we're idle — otherwise our
      // own command stream is already being rendered.
      if (runningIdRef.current) return
      switch (event.type) {
        case "ai-banner":
          write(`\r\n\x1b[36m\x1b[1m[AI]\x1b[0m ${DIM}$ ${event.command}${RESET}\r\n`)
          break
        case "http-banner":
          write(`\r\n\x1b[35m\x1b[1m[HTTP]\x1b[0m ${DIM}$ ${event.command}${RESET}\r\n`)
          break
        case "stdout":
          if (event.data) renderOutput(event.data, false)
          break
        case "stderr":
          if (event.data) renderOutput(event.data, true)
          break
        case "ai-footer":
        case "http-footer": {
          const tag = event.type === "ai-footer" ? "[AI]" : "[HTTP]"
          const code = event.signal
            ? `${YELLOW}signal=${event.signal}${RESET}`
            : event.exitCode === 0
              ? `${GREEN}exit=0${RESET}`
              : `${RED}exit=${event.exitCode}${RESET}`
          write(`${DIM}${tag} ${code} (${event.durationMs ?? 0}ms)${RESET}\r\n`)
          writePrompt()
          break
        }
      }
    }

    function renderOutput(data: string, isErr: boolean) {
      // Convert lone LF → CRLF so xterm renders without raw-mode TTY.
      const normalised = data.replace(/\r?\n/g, "\r\n")
      if (isErr) write(`${RED}${normalised}${RESET}`)
      else       write(normalised)
    }

    function finishCommand(
      exitCode: number | null,
      signal:   string | null,
      durationMs: number,
      truncated: boolean,
    ) {
      runningIdRef.current = null
      const code = signal
        ? `${YELLOW}signal=${signal}${RESET}`
        : exitCode === 0
          ? `${GREEN}✓${RESET}`
          : `${RED}exit=${exitCode}${RESET}`
      const tail = truncated ? ` ${YELLOW}(output truncated)${RESET}` : ""
      write(`\r\n${DIM}${code}  ${durationMs}ms${tail}${RESET}`)
      writePrompt()
    }

    // ── Line editor ────────────────────────────────────────────────────────
    function handleTermInput(data: string) {
      // While a command is executing, only Ctrl+C is meaningful.
      if (runningIdRef.current) {
        if (data === "\x03") cancelRunning()
        return
      }

      for (const ch of data) {
        const code = ch.charCodeAt(0)

        // Enter
        if (ch === "\r" || ch === "\n") {
          submit()
          continue
        }
        // Backspace (DEL or BS)
        if (code === 0x7f || code === 0x08) {
          if (cursorRef.current > 0) {
            const left  = inputRef.current.slice(0, cursorRef.current - 1)
            const right = inputRef.current.slice(cursorRef.current)
            inputRef.current = left + right
            cursorRef.current -= 1
            // Erase one char + redraw tail
            write("\b" + right + " ")
            // Move cursor back over the redrawn tail + the eaten space.
            write(`\x1b[${right.length + 1}D`)
          }
          continue
        }
        // Ctrl+C
        if (ch === "\x03") {
          inputRef.current  = ""
          cursorRef.current = 0
          write(`${RED}^C${RESET}`)
          writePrompt()
          continue
        }
        // Ctrl+L (clear)
        if (ch === "\x0c") {
          term.clear()
          writePrompt()
          continue
        }
        // Ctrl+U — kill line
        if (ch === "\x15") {
          if (cursorRef.current > 0) {
            const right = inputRef.current.slice(cursorRef.current)
            // Move to start of input, clear to end, restore tail
            write(`\x1b[${cursorRef.current}D\x1b[K${right}`)
            inputRef.current  = right
            cursorRef.current = 0
            if (right.length) write(`\x1b[${right.length}D`)
          }
          continue
        }
        // Escape sequences: arrows etc.  data may contain "\x1b[A" etc.
        if (ch === "\x1b") {
          // Handled below by checking the rest of the data string.
          // We'll break out; arrow handling is done after this loop.
          handleEscape(data)
          return
        }
        // Printable
        if (code >= 0x20 && code !== 0x7f) {
          const left  = inputRef.current.slice(0, cursorRef.current)
          const right = inputRef.current.slice(cursorRef.current)
          inputRef.current = left + ch + right
          cursorRef.current += 1
          if (right.length === 0) {
            write(ch)
          } else {
            write(ch + right + `\x1b[${right.length}D`)
          }
        }
      }
    }

    function handleEscape(data: string) {
      // Recognise simple arrow keys + Home/End.
      if (data === "\x1b[A") {                 // Up
        navigateHistory(-1)
      } else if (data === "\x1b[B") {          // Down
        navigateHistory(+1)
      } else if (data === "\x1b[C") {          // Right
        if (cursorRef.current < inputRef.current.length) {
          cursorRef.current += 1
          write("\x1b[C")
        }
      } else if (data === "\x1b[D") {          // Left
        if (cursorRef.current > 0) {
          cursorRef.current -= 1
          write("\x1b[D")
        }
      } else if (data === "\x1b[H" || data === "\x1bOH") {
        if (cursorRef.current > 0) {
          write(`\x1b[${cursorRef.current}D`)
          cursorRef.current = 0
        }
      } else if (data === "\x1b[F" || data === "\x1bOF") {
        const off = inputRef.current.length - cursorRef.current
        if (off > 0) {
          write(`\x1b[${off}C`)
          cursorRef.current = inputRef.current.length
        }
      }
    }

    function navigateHistory(direction: -1 | 1) {
      const hist = historyRef.current
      if (hist.length === 0) return
      if (historyIdxRef.current === -1 && direction === 1) return

      if (historyIdxRef.current === -1) {
        // Save the current draft before walking back into history.
        draftRef.current = inputRef.current
      }

      let next = historyIdxRef.current + direction
      if (next < 0) next = 0
      if (next > hist.length) next = hist.length

      // Map next index → value:  hist[hist.length - 1 - next]; index === hist.length means draft.
      let value: string
      if (next >= hist.length) {
        value = draftRef.current
        historyIdxRef.current = -1
      } else {
        value = hist[hist.length - 1 - next]
        historyIdxRef.current = next
      }

      // Erase current input visually.
      if (cursorRef.current > 0) write(`\x1b[${cursorRef.current}D`)
      write("\x1b[K")
      // Replace and redraw.
      inputRef.current  = value
      cursorRef.current = value.length
      write(value)
    }

    function submit() {
      const command = inputRef.current
      inputRef.current  = ""
      cursorRef.current = 0
      historyIdxRef.current = -1
      draftRef.current  = ""

      write("\r\n")

      if (!command.trim()) {
        writePrompt()
        return
      }

      // Push to history (dedupe consecutive duplicates).
      const hist = historyRef.current
      if (hist[hist.length - 1] !== command) hist.push(command)
      if (hist.length > 500) hist.shift()

      void runCommand(command)
    }

    async function runCommand(command: string) {
      const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      runningIdRef.current = id

      const transport = statusRef.current
      if (transport === "websocket" && socketRef.current?.connected) {
        socketRef.current.emit("exec", {
          id,
          command,
          cwd: cwdRef.current,
        })
        return
      }

      // HTTP fallback
      const ac = new AbortController()
      httpAbortRef.current = ac
      const start = Date.now()
      try {
        const resp = await fetch("/api/terminal/exec", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ command, cwd: cwdRef.current, silent: true }),
          signal:  ac.signal,
        })
        if (!resp.ok) {
          const text = await resp.text().catch(() => "")
          renderOutput(`HTTP ${resp.status}: ${text}\n`, true)
          finishCommand(null, null, Date.now() - start, false)
          return
        }
        const result = await resp.json() as {
          stdout: string; stderr: string; exitCode: number | null;
          signal: string | null; cwd: string; durationMs: number; truncated: boolean
        }
        if (result.stdout) renderOutput(result.stdout, false)
        if (result.stderr) renderOutput(result.stderr, true)
        cwdRef.current = result.cwd || cwdRef.current
        finishCommand(result.exitCode, result.signal, result.durationMs, result.truncated)
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          renderOutput("\n^C cancelled\n", true)
          finishCommand(null, "SIGTERM", Date.now() - start, false)
        } else {
          renderOutput(`\nrequest failed: ${(err as Error).message}\n`, true)
          finishCommand(null, null, Date.now() - start, false)
        }
      } finally {
        httpAbortRef.current = null
      }
    }

    function cancelRunning() {
      const id = runningIdRef.current
      if (!id) return
      write(`\r\n${RED}^C${RESET}`)
      if (statusRef.current === "websocket" && socketRef.current?.connected) {
        socketRef.current.emit("cancel", { id })
      } else if (httpAbortRef.current) {
        httpAbortRef.current.abort()
      }
    }

    init()

    return () => {
      disposed = true
      ro?.disconnect()
      try { socketRef.current?.disconnect() } catch { /* ignore */ }
      socketRef.current = null
      try { httpAbortRef.current?.abort() } catch { /* ignore */ }
      httpAbortRef.current = null
      try { term?.dispose() } catch { /* ignore */ }
      termRef.current = null
      fitRef.current  = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full"
        style={{ background: "#0a0a0a" }}
      />
      {/* Hidden status mirror — useful for debugging in DevTools */}
      <span data-terminal-status={status} className="sr-only">{status}</span>
    </div>
  )
})
