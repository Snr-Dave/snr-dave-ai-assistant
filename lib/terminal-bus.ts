/**
 * Terminal broadcast bus.
 *
 * `pages/api/terminal/shell.ts` initialises a Socket.IO server and registers it
 * here so other server-side modules (e.g. the chat route's `executeBash` tool)
 * can stream their own output into the user's live System Console.
 *
 * We intentionally stash the server on `globalThis` so it survives Next.js dev
 * HMR module reloads — both API routes (App + Pages) share the same Node
 * process on Replit, so a singleton is safe.
 */

import type { Server as IOServer } from "socket.io"

declare global {
  // eslint-disable-next-line no-var
  var __terminalIo: IOServer | undefined
}

/** Called once by the terminal route after `new SocketIOServer(...)`. */
export function registerTerminalIo(io: IOServer): void {
  globalThis.__terminalIo = io
}

/** Returns the live io instance, or `null` if the terminal has never been opened yet. */
export function getTerminalIo(): IOServer | null {
  return globalThis.__terminalIo ?? null
}

/**
 * Emit raw terminal data to every connected console client.
 * Returns `true` when the bus has at least one connected client and the emit
 * succeeded, `false` when no console is open (caller can decide to warn).
 *
 * `text` is sent as-is — include `\r\n` line endings and ANSI escape codes
 * exactly as you want them rendered by xterm.
 */
export function broadcastToConsole(text: string): boolean {
  const io = globalThis.__terminalIo
  if (!io) return false
  // `sockets` is the default namespace's `Set<Socket>`
  if (io.sockets.sockets.size === 0) return false
  io.emit("output", text)
  return true
}
