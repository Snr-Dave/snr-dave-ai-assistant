import type { NextApiRequest, NextApiResponse } from "next"
import { Server as SocketIOServer } from "socket.io"
import { spawn } from "child_process"
import type { Socket as NetSocket } from "net"
import type { Server as HTTPServer } from "http"
import type { Server as IOServer } from "socket.io"
import { registerTerminalIo } from "@/lib/terminal-bus"

// ── Type augmentation ────────────────────────────────────────────────────────

interface SocketWithIO extends NetSocket {
  server: HTTPServer & { io?: IOServer }
}

interface ResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

// ── Config ───────────────────────────────────────────────────────────────────

export const config = { api: { bodyParser: false } }

// ── Handler ──────────────────────────────────────────────────────────────────

export default function handler(_req: NextApiRequest, res: ResponseWithSocket) {
  if (!res.socket.server.io) {
    console.log("[terminal] Initialising Socket.IO server…")

    const io = new SocketIOServer(res.socket.server, {
      // Use a dedicated path to avoid collisions with any future socket.io usage
      path: "/api/terminal/socket.io",
      cors: { origin: "*", methods: ["GET", "POST"] },
      // Allow the browser to reach us even through Replit's proxy
      transports: ["websocket", "polling"],
    })

    res.socket.server.io = io
    registerTerminalIo(io)

    io.on("connection", (socket) => {
      console.log("[terminal] Client connected:", socket.id)

      // ── Spawn /bin/bash ────────────────────────────────────────────────────
      const shell = spawn("/bin/bash", ["-i"], {
        env: {
          ...process.env,
          TERM:      "xterm-256color",
          COLORTERM: "truecolor",
          // Force a clean, readable prompt
          PS1: "\\[\\e[36m\\]\\u@workspace\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ ",
        },
        cwd: "/home/runner/workspace",
        // Keep stdin open
        stdio: ["pipe", "pipe", "pipe"],
      })

      // ── Pipe stdout + stderr → client ──────────────────────────────────────
      shell.stdout.on("data", (chunk: Buffer) => {
        socket.emit("output", chunk.toString("utf-8"))
      })

      shell.stderr.on("data", (chunk: Buffer) => {
        socket.emit("output", chunk.toString("utf-8"))
      })

      // ── Pipe client input → stdin ──────────────────────────────────────────
      socket.on("input", (data: string) => {
        try { shell.stdin.write(data) } catch { /* shell may be closing */ }
      })

      // ── Shell exit ────────────────────────────────────────────────────────
      shell.on("exit", (code, signal) => {
        console.log(`[terminal] Shell exited — code=${code} signal=${signal}`)
        socket.emit("exit", code ?? 0)
      })

      shell.on("error", (err) => {
        console.error("[terminal] Shell error:", err.message)
        socket.emit("output", `\r\n\x1b[31mShell error: ${err.message}\x1b[0m\r\n`)
      })

      // ── Client disconnect ─────────────────────────────────────────────────
      socket.on("disconnect", () => {
        console.log("[terminal] Client disconnected:", socket.id)
        try { shell.kill("SIGHUP") } catch { /* already dead */ }
      })
    })
  }

  res.end()
}
