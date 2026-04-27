/**
 * Universal Shell — HTTP POST executor.
 *
 * Stateless one-shot endpoint. Used by the Hybrid Terminal whenever the
 * WebSocket bridge is unavailable (Vercel, StackBlitz, locked-down proxies),
 * and by the AI Assistant as a structured-output execution surface.
 *
 * Request body:
 *   { command: string, cwd?: string, timeoutMs?: number }
 *
 * Response (always JSON, even on failure):
 *   {
 *     command:    string
 *     exitCode:   number | null
 *     signal:     string | null
 *     stdout:     string
 *     stderr:     string
 *     cwd:        string        // resolved CWD after running (so client can persist `cd`)
 *     durationMs: number
 *     truncated:  boolean
 *   }
 *
 * GH_TOKEN and GITHUB_TOKEN are injected for every command — `git` and the
 * `gh` CLI authenticate against any Snr-Dave repository automatically.
 */

import { execShell, MAX_TIMEOUT } from "@/lib/exec-shell"
import { broadcastConsole } from "@/lib/terminal-bus"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ExecRequest {
  command?:   unknown
  cwd?:       unknown
  timeoutMs?: unknown
  /** When true, suppresses mirroring this command's output to live WS clients. */
  silent?:    unknown
}

function jsonError(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { "Content-Type": "application/json" } },
  )
}

export async function POST(req: Request) {
  let body: ExecRequest
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON body", 400)
  }

  const command = typeof body.command === "string" ? body.command.trim() : ""
  if (!command) return jsonError("`command` must be a non-empty string", 400)

  const cwd       = typeof body.cwd       === "string" ? body.cwd       : undefined
  const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : undefined
  const silent    = body.silent === true
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    return jsonError(`\`timeoutMs\` must be a positive number (max ${MAX_TIMEOUT})`, 400)
  }

  // Wire the request's abort signal so a client disconnect kills the process.
  const ac = new AbortController()
  req.signal.addEventListener("abort", () => ac.abort(), { once: true })

  // Mirror the command + output to any connected WebSocket consoles unless
  // explicitly silenced (e.g. health-check pings).
  if (!silent) {
    broadcastConsole({ type: "http-banner", command })
  }

  const result = await execShell(command, {
    cwd,
    timeoutMs,
    signal:   ac.signal,
    onStdout: (chunk) => { if (!silent) broadcastConsole({ type: "stdout", data: chunk }) },
    onStderr: (chunk) => { if (!silent) broadcastConsole({ type: "stderr", data: chunk }) },
  })

  if (!silent) {
    broadcastConsole({
      type:       "http-footer",
      exitCode:   result.exitCode,
      signal:     result.signal,
      durationMs: result.durationMs,
    })
  }

  return new Response(JSON.stringify(result), {
    status:  200,
    headers: { "Content-Type": "application/json" },
  })
}

export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok", endpoint: "terminal/exec", method: "POST" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )
}
