import type { NextApiRequest, NextApiResponse } from "next"
import fs   from "node:fs/promises"
import path from "node:path"

// ── Configuration ────────────────────────────────────────────────────────────
const ENV_PATH = path.join(process.cwd(), ".env")
const KEY_RE   = /^[A-Z_][A-Z0-9_]*$/i
const FILE_MODE = 0o600

/** Keys we always surface, even when missing from .env, so the UI is useful out-of-the-box. */
const SEEDED_KEYS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_API_KEY",
  "GITHUB_TOKEN",
  "SESSION_SECRET",
] as const

interface EnvEntry { key: string; value: string }

// ── Parser (format-preserving) ───────────────────────────────────────────────
function parseEnv(content: string): EnvEntry[] {
  const out: EnvEntry[] = []
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue

    const key = line.slice(0, eq).trim()
    if (!KEY_RE.test(key)) continue

    let value = line.slice(eq + 1).trim()
    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out.push({ key, value })
  }
  return out
}

/** Quote the value if it contains whitespace, '#', or '=' so dotenv parses it correctly. */
function quoteIfNeeded(value: string): string {
  if (value === "")                 return ""
  if (/[\s#"'=]/.test(value)) {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    return `"${escaped}"`
  }
  return value
}

/**
 * Replace KEY=… on its line, preserving indentation, comments, blank lines,
 * and unrelated entries. Append the entry at end of file when missing.
 */
function upsertEnv(content: string, key: string, value: string): string {
  const formatted = `${key}=${quoteIfNeeded(value)}`
  const lines     = content.split(/\r?\n/)
  let replaced    = false

  const updated = lines.map((raw) => {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith("#")) return raw
    const eq = trimmed.indexOf("=")
    if (eq <= 0) return raw
    const lineKey = trimmed.slice(0, eq).trim()
    if (lineKey !== key) return raw

    replaced = true
    const indent = raw.match(/^\s*/)?.[0] ?? ""
    return `${indent}${formatted}`
  })

  if (!replaced) {
    // Ensure trailing newline before appending
    if (updated.length === 0 || updated[updated.length - 1] !== "") {
      updated.push("")
    }
    updated.push(formatted)
  }
  return updated.join("\n")
}

/**
 * Remove every line that defines KEY=…, preserving every other line (comments,
 * blank lines, and unrelated entries). Returns content unchanged if absent.
 */
function removeKey(content: string, key: string): string {
  const lines = content.split(/\r?\n/)
  const out: string[] = []
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith("#")) { out.push(raw); continue }
    const eq = trimmed.indexOf("=")
    if (eq <= 0) { out.push(raw); continue }
    if (trimmed.slice(0, eq).trim() === key) continue   // drop this line
    out.push(raw)
  }
  return out.join("\n")
}

// ── File helpers ─────────────────────────────────────────────────────────────
async function readEnvFile(): Promise<string> {
  try {
    return await fs.readFile(ENV_PATH, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw err
  }
}

/**
 * Atomic-ish write: writeFile with mode 0600, then chmod again to guarantee
 * permissions even on filesystems where the create-mode hint was ignored
 * (e.g. when the file already existed with a different mode).
 */
async function writeEnvFile(content: string): Promise<void> {
  await fs.writeFile(ENV_PATH, content, { mode: FILE_MODE })
  try { await fs.chmod(ENV_PATH, FILE_MODE) } catch { /* best effort */ }
}

/** Merge file entries with seeded keys, with file values taking precedence. */
function mergeWithSeeds(fileEntries: EnvEntry[]): EnvEntry[] {
  const map = new Map<string, string>()
  for (const k of SEEDED_KEYS) map.set(k, "")
  for (const e of fileEntries) map.set(e.key, e.value)
  return Array.from(map, ([key, value]) => ({ key, value }))
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store")

  try {
    // ── GET: list every entry ───────────────────────────────────────────────
    if (req.method === "GET") {
      const content = await readEnvFile()
      const entries = mergeWithSeeds(parseEnv(content))
      return res.status(200).json({ entries })
    }

    // ── PUT: create / update / rename ───────────────────────────────────────
    //
    //   { key, value }            → upsert KEY=value
    //   { key, value, oldKey }    → if oldKey !== key, delete oldKey line,
    //                                then upsert KEY=value (rename preserves value)
    //
    if (req.method === "PUT") {
      const body = (req.body ?? {}) as { key?: string; value?: string; oldKey?: string }
      const { key, value, oldKey } = body

      if (typeof key !== "string" || !KEY_RE.test(key)) {
        return res.status(400).json({ error: "Invalid key. Use UPPER_SNAKE_CASE letters, digits, underscores." })
      }
      if (typeof value !== "string") {
        return res.status(400).json({ error: "Value must be a string." })
      }
      if (value.length > 8192) {
        return res.status(413).json({ error: "Value exceeds 8 KB limit." })
      }
      if (oldKey !== undefined && (typeof oldKey !== "string" || !KEY_RE.test(oldKey))) {
        return res.status(400).json({ error: "Invalid oldKey." })
      }

      const current = await readEnvFile()

      // If renaming and the new key already exists in the file (and it's not
      // the same key being saved over), refuse — caller should resolve the conflict.
      if (oldKey && oldKey !== key) {
        const existing = parseEnv(current).map((e) => e.key)
        if (existing.includes(key)) {
          return res.status(409).json({ error: `Key ${key} already exists. Pick a different name.` })
        }
      }

      let next = current
      if (oldKey && oldKey !== key) {
        next = removeKey(next, oldKey)
        delete process.env[oldKey]
      }
      next = upsertEnv(next, key, value)
      await writeEnvFile(next)

      // Update the live process env so subsequent requests in this Node instance see it.
      process.env[key] = value

      return res.status(200).json({ ok: true, key, value, renamedFrom: oldKey ?? null })
    }

    // ── DELETE: remove a key ────────────────────────────────────────────────
    //
    //   ?key=FOO   or   { "key": "FOO" } in JSON body
    //
    if (req.method === "DELETE") {
      const fromQuery = typeof req.query.key === "string" ? req.query.key : undefined
      const fromBody  = typeof (req.body as { key?: unknown })?.key === "string"
        ? ((req.body as { key: string }).key)
        : undefined
      const key = fromQuery ?? fromBody

      if (typeof key !== "string" || !KEY_RE.test(key)) {
        return res.status(400).json({ error: "Invalid or missing key." })
      }

      const current = await readEnvFile()
      const present = parseEnv(current).some((e) => e.key === key)
      const next    = removeKey(current, key)
      await writeEnvFile(next)
      delete process.env[key]

      return res.status(200).json({ ok: true, key, removed: present })
    }

    res.setHeader("Allow", "GET, PUT, DELETE")
    return res.status(405).json({ error: "Method not allowed" })
  } catch (err) {
    console.error("[env-api]", err)
    return res.status(500).json({ error: "Internal error" })
  }
}
