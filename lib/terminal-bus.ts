/**
 * Terminal broadcast bus.
 *
 * `pages/api/terminal/shell.ts` initialises a Socket.IO server and registers
 * it here so other server-side modules (e.g. the chat route's `executeBash`
 * tool, the HTTP `/api/terminal/exec` route) can mirror their output into
 * every connected live console.
 *
 * We stash the io instance on `globalThis` so it survives Next.js dev HMR
 * reloads — both API routes (App + Pages routers) share the same Node
 * process on Replit, so a singleton is safe.
 */

import type { Server as IOServer } from "socket.io"

declare global {
  // eslint-disable-next-line no-var
  var __terminalIo: IOServer | undefined
}

/** Called once by the WebSocket route after `new SocketIOServer(...)`. */
export function registerTerminalIo(io: IOServer): void {
  globalThis.__terminalIo = io
}

/** Returns the live io instance, or `null` if no console has been opened. */
export function getTerminalIo(): IOServer | null {
  return globalThis.__terminalIo ?? null
}

// ── Console broadcast events ─────────────────────────────────────────────────

export type ConsoleEvent =
  | { type: "stdout";       data: string }
  | { type: "stderr";       data: string }
  | { type: "ai-banner";    command: string }
  | { type: "ai-footer";    exitCode: number | null; signal: string | null; durationMs: number }
  | { type: "http-banner";  command: string }
  | { type: "http-footer";  exitCode: number | null; signal: string | null; durationMs: number }

/**
 * Mirror an event to every connected live console (xterm WebSocket clients).
 * Returns `true` when at least one console is connected and the emit was
 * dispatched, `false` otherwise.
 */
export function broadcastConsole(event: ConsoleEvent): boolean {
  const io = globalThis.__terminalIo
  if (!io) return false
  if (io.sockets.sockets.size === 0) return false
  io.emit("broadcast", event)
  return true
}
