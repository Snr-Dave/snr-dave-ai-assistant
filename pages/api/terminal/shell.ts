/**
 * Universal Shell — WebSocket bridge.
 *
 * Lazily initialises a Socket.IO server at `/api/terminal/socket.io` so the
 * Hybrid Terminal can stream commands with sub-millisecond latency on
 * environments that support persistent server processes (Replit, self-hosted
 * Node). On serverless platforms (Vercel, StackBlitz) this route never
 * succeeds the WS upgrade and the client falls back to `/api/terminal/exec`.
 *
 * Protocol (replaces the legacy interactive-bash PTY):
 *   ┌─ client → server ──────────────────────────────────────────────────┐
 *   │ exec    { id, command, cwd?, timeoutMs? }                          │
 *   │ cancel  { id }                                                     │
 *   └────────────────────────────────────────────────────────────────────┘
 *   ┌─ server → client ──────────────────────────────────────────────────┐
 *   │ output  { id, stream: 'stdout' | 'stderr', data }                  │
 *   │ done    { id, exitCode, signal, cwd, durationMs, truncated }      │
 *   │ broadcast (relay of `ConsoleEvent` from terminal-bus — AI / HTTP)  │
 *   └────────────────────────────────────────────────────────────────────┘
 */

import type { NextApiRequest, NextApiResponse } from "next"
import { Server as SocketIOServer } from "socket.io"
import type { Socket as NetSocket } from "net"
import type { Server as HTTPServer } from "http"
import type { Server as IOServer } from "socket.io"
import { execShell, MAX_TIMEOUT } from "@/lib/exec-shell"
import { registerTerminalIo, broadcastConsole } from "@/lib/terminal-bus"

// ── Type augmentation ────────────────────────────────────────────────────────

interface SocketWithIO extends NetSocket {
  server: HTTPServer & { io?: IOServer }
}
interface ResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

export const config = { api: { bodyParser: false } }

// ── Handler ──────────────────────────────────────────────────────────────────

export default function handler(_req: NextApiRequest, res: ResponseWithSocket) {
  if (res.socket.server.io) {
    res.end()
    return
  }

  console.log("[terminal/ws] Initialising Universal Shell WebSocket bridge…")

  const io = new SocketIOServer(res.socket.server, {
    path:       "/api/terminal/socket.io",
    cors:       { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  })

  res.socket.server.io = io
  registerTerminalIo(io)

  io.on("connection", (socket) => {
    console.log("[terminal/ws] Client connected:", socket.id)

    /** Active executions for this socket → AbortController to cancel them. */
    const active = new Map<string, AbortController>()

    socket.emit("hello", { ok: true, transport: "websocket" })

    socket.on("exec", async (payload: unknown) => {
      const { id, command, cwd, timeoutMs } = (payload ?? {}) as {
        id?:        string
        command?:   string
        cwd?:       string
        timeoutMs?: number
      }
      if (typeof id !== "string" || !id) {
        socket.emit("done", { id: "?", exitCode: null, signal: null, cwd: cwd ?? "", durationMs: 0, truncated: false, error: "missing id" })
        return
      }
      if (typeof command !== "string" || !command.trim()) {
        socket.emit("done", { id, exitCode: null, signal: null, cwd: cwd ?? "", durationMs: 0, truncated: false, error: "missing command" })
        return
      }

      const ac = new AbortController()
      active.set(id, ac)

      const result = await execShell(command, {
        cwd,
        timeoutMs: typeof timeoutMs === "number" ? Math.min(timeoutMs, MAX_TIMEOUT) : undefined,
        signal:    ac.signal,
        onStdout:  (data) => socket.emit("output", { id, stream: "stdout", data }),
        onStderr:  (data) => socket.emit("output", { id, stream: "stderr", data }),
      })

      active.delete(id)
      socket.emit("done", {
        id,
        exitCode:   result.exitCode,
        signal:     result.signal,
        cwd:        result.cwd,
        durationMs: result.durationMs,
        truncated:  result.truncated,
      })
    })

    socket.on("cancel", (payload: unknown) => {
      const { id } = (payload ?? {}) as { id?: string }
      if (typeof id !== "string") return
      const ac = active.get(id)
      if (ac) {
        ac.abort()
        active.delete(id)
      }
    })

    socket.on("disconnect", () => {
      console.log("[terminal/ws] Client disconnected:", socket.id)
      // Kill anything still running for this client.
      for (const ac of active.values()) {
        try { ac.abort() } catch { /* ignore */ }
      }
      active.clear()
    })
  })

  // Sanity ping so other modules can quickly verify the bus is alive.
  void broadcastConsole // referenced to mark export usage to TS in dev

  res.end()
}
