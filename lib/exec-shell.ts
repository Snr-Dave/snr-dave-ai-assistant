/**
 * Universal Shell executor — single source of truth for running shell commands.
 *
 * Used by:
 *   • `app/api/terminal/exec/route.ts`     — HTTP POST one-shot executor
 *   • `pages/api/terminal/shell.ts`        — Socket.IO streaming executor
 *   • `app/api/chat/route.ts` (executeBash)— AI assistant tool
 *
 * Behaviour:
 *   • Always runs under `/bin/bash -c` inside `/home/runner/workspace` (or a
 *     caller-supplied CWD).
 *   • Always injects `GH_TOKEN` and `GITHUB_TOKEN` so `git` and the `gh` CLI
 *     authenticate against every Snr-Dave repository out of the box.
 *   • Wraps the user command so the resolved working-directory is reported
 *     back to the caller (enables persistent `cd` across separate execs).
 *   • Streams stdout / stderr through caller-provided callbacks **with the
 *     CWD-marker stripped out** so terminals only see real command output.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

// ── Constants ────────────────────────────────────────────────────────────────

export const WORKSPACE_CWD     = "/home/runner/workspace"
export const DEFAULT_TIMEOUT   = 30_000
export const MAX_TIMEOUT       = 5 * 60_000
export const MAX_OUTPUT_BYTES  = 256 * 1024

const CWD_OPEN  = "\x1f__SNRDAVE_CWD__"
const CWD_CLOSE = "\x1f"

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExecOptions {
  /** Working directory for this command. Defaults to the workspace root. */
  cwd?:        string
  /** Hard kill timeout in ms. Clamped to [1_000, MAX_TIMEOUT]. */
  timeoutMs?:  number
  /** Streaming callbacks — invoked with cleaned chunks (CWD marker removed). */
  onStdout?:   (chunk: string) => void
  onStderr?:   (chunk: string) => void
  /** Optional abort signal — calling .abort() sends SIGTERM, then SIGKILL. */
  signal?:     AbortSignal
  /** Extra environment variables to merge on top of the inherited env. */
  env?:        Record<string, string>
}

export interface ExecResult {
  command:    string
  exitCode:   number | null
  signal:     string | null
  stdout:     string
  stderr:     string
  /** Working directory after the command completed (resolves `cd …`). */
  cwd:        string
  durationMs: number
  truncated:  boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the GitHub token used to populate `GH_TOKEN` and `GITHUB_TOKEN`.
 * Prefers an explicit override, then falls back to `GITHUB_TOKEN` (canonical),
 * then `GH_TOKEN`.
 */
function resolveGithubToken(): string | undefined {
  return (
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    undefined
  )
}

/**
 * Builds the env passed to the spawned bash process. Always sets both
 * `GH_TOKEN` and `GITHUB_TOKEN` (when available) and standard terminal vars.
 */
export function buildShellEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const token = resolveGithubToken()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TERM:      "xterm-256color",
    COLORTERM: "truecolor",
    PAGER:     "cat",
    GIT_PAGER: "cat",
  }
  if (token) {
    env.GH_TOKEN     = token
    env.GITHUB_TOKEN = token
  }
  if (extra) Object.assign(env, extra)
  return env
}

/**
 * Wraps the user command so the resolved CWD is reported on stdout via a
 * private control-sequence marker. The marker is stripped from the visible
 * output by the stdout filter below.
 */
function wrapCommand(userCommand: string, cwd: string): string {
  // shell-quote paths safely (single-quoted, escape embedded single quotes)
  const safeCwd       = `'${cwd.replace(/'/g, `'\\''`)}'`
  const safeWorkspace = `'${WORKSPACE_CWD.replace(/'/g, `'\\''`)}'`
  // Use real newlines so the user command can itself contain `;`, `&&`, here-
  // docs, comments, etc. without colliding with our trailer.
  return [
    `cd ${safeCwd} 2>/dev/null || cd ${safeWorkspace}`,
    userCommand,
    `__snrdave_rc=$?`,
    `printf '${CWD_OPEN}%s${CWD_CLOSE}' "$(pwd)"`,
    `exit $__snrdave_rc`,
  ].join("\n")
}

/**
 * Stateful filter that removes the CWD marker from a chunk-stream while
 * remembering the resolved CWD. Handles markers split across chunks.
 */
function createCwdFilter() {
  let pending = ""
  let resolved: string | null = null
  // Hold back at most this many trailing bytes per chunk in case the marker
  // straddles the boundary (open-marker + 4096-byte path + close-marker).
  const MAX_HOLDBACK = CWD_OPEN.length + 4096 + CWD_CLOSE.length

  function process(chunk: string): string {
    if (resolved !== null) {
      // Marker already consumed — anything after is unexpected, swallow it.
      return ""
    }
    const combined = pending + chunk
    const openIdx  = combined.indexOf(CWD_OPEN)

    if (openIdx === -1) {
      // No marker yet, but maybe the start of one is just at the tail.
      if (combined.length > MAX_HOLDBACK) {
        const cut = combined.length - MAX_HOLDBACK
        pending   = combined.slice(cut)
        return combined.slice(0, cut)
      }
      pending = combined
      return ""
    }

    const before = combined.slice(0, openIdx)
    const after  = combined.slice(openIdx + CWD_OPEN.length)
    const closeIdx = after.indexOf(CWD_CLOSE)
    if (closeIdx === -1) {
      // Open marker found but path not yet complete — hold from open marker.
      pending = combined.slice(openIdx)
      return before
    }

    resolved = after.slice(0, closeIdx)
    pending  = ""
    return before
  }

  function flush(): string {
    const tail = pending
    pending = ""
    return tail
  }

  return {
    process,
    flush,
    getCwd: () => resolved,
  }
}

// ── Core executor ────────────────────────────────────────────────────────────

/**
 * Run a single shell command. Streams output through the supplied callbacks
 * (with the CWD marker stripped) and resolves with the captured result.
 */
export function execShell(command: string, opts: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const trimmed = (command ?? "").trim()
    const start   = Date.now()
    const cwd     = opts.cwd && typeof opts.cwd === "string" ? opts.cwd : WORKSPACE_CWD
    const timeout = Math.min(
      Math.max(typeof opts.timeoutMs === "number" ? opts.timeoutMs : DEFAULT_TIMEOUT, 1_000),
      MAX_TIMEOUT,
    )

    if (!trimmed) {
      resolve({
        command: trimmed,
        exitCode: 0, signal: null,
        stdout: "", stderr: "",
        cwd, durationMs: 0, truncated: false,
      })
      return
    }

    const wrapped = wrapCommand(trimmed, cwd)
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn("/bin/bash", ["-c", wrapped], {
        cwd:   WORKSPACE_CWD,   // initial; the wrapper jumps to opts.cwd itself
        env:   buildShellEnv(opts.env),
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (err) {
      resolve({
        command: trimmed,
        exitCode: null, signal: null,
        stdout: "",
        stderr: `spawn failed: ${err instanceof Error ? err.message : String(err)}`,
        cwd, durationMs: Date.now() - start, truncated: false,
      })
      return
    }

    const filter   = createCwdFilter()
    let stdoutBuf  = ""
    let stderrBuf  = ""
    let truncated  = false

    const append = (cur: string, add: string): string => {
      if (cur.length >= MAX_OUTPUT_BYTES) { truncated = true; return cur }
      const room = MAX_OUTPUT_BYTES - cur.length
      if (add.length > room) {
        truncated = true
        return cur + add.slice(0, room) + "\n…[truncated]"
      }
      return cur + add
    }

    child.stdout.setEncoding("utf-8")
    child.stderr.setEncoding("utf-8")

    child.stdout.on("data", (chunk: string) => {
      const visible = filter.process(chunk)
      if (visible) {
        stdoutBuf = append(stdoutBuf, visible)
        opts.onStdout?.(visible)
      }
    })

    child.stderr.on("data", (chunk: string) => {
      stderrBuf = append(stderrBuf, chunk)
      opts.onStderr?.(chunk)
    })

    let killed = false
    const killer = (sig: NodeJS.Signals) => {
      try { child.kill(sig) } catch { /* ignore */ }
    }

    const hardKillTimer = setTimeout(() => {
      killed = true
      killer("SIGTERM")
      setTimeout(() => killer("SIGKILL"), 2_000)
    }, timeout)

    const onAbort = () => {
      killed = true
      killer("SIGTERM")
      setTimeout(() => killer("SIGKILL"), 2_000)
    }
    if (opts.signal) {
      if (opts.signal.aborted) onAbort()
      else opts.signal.addEventListener("abort", onAbort, { once: true })
    }

    const finish = (exitCode: number | null, signal: string | null) => {
      clearTimeout(hardKillTimer)
      opts.signal?.removeEventListener("abort", onAbort)

      // Drain anything still in the filter buffer (only happens if the
      // wrapper failed to print the marker, e.g. process killed).
      const tail = filter.flush()
      if (tail) {
        stdoutBuf = append(stdoutBuf, tail)
        opts.onStdout?.(tail)
      }

      resolve({
        command:    trimmed,
        exitCode,
        signal:     signal ?? (killed ? "SIGTERM" : null),
        stdout:     stdoutBuf,
        stderr:     stderrBuf,
        cwd:        filter.getCwd() ?? cwd,
        durationMs: Date.now() - start,
        truncated,
      })
    }

    child.on("error", (err) => {
      const msg = `\nspawn error: ${err.message}`
      stderrBuf = append(stderrBuf, msg)
      opts.onStderr?.(msg)
      finish(null, null)
    })

    child.on("close", (code, signal) => {
      finish(code, signal)
    })
  })
}
