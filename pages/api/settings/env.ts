import type { NextApiRequest, NextApiResponse } from "next"
import fs   from "node:fs/promises"
import path from "node:path"

// ── Configuration ────────────────────────────────────────────────────────────
const ENV_PATH = path.join(process.cwd(), ".env")
const KEY_RE   = /^[A-Z_][A-Z0-9_]*$/i

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

// ── File helpers ─────────────────────────────────────────────────────────────
async function readEnvFile(): Promise<string> {
  try {
    return await fs.readFile(ENV_PATH, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw err
  }
}

async function writeEnvFile(content: string): Promise<void> {
  await fs.writeFile(ENV_PATH, content, { mode: 0o600 })
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
    if (req.method === "GET") {
      const content = await readEnvFile()
      const entries = mergeWithSeeds(parseEnv(content))
      return res.status(200).json({ entries })
    }

    if (req.method === "PUT") {
      const { key, value } = (req.body ?? {}) as { key?: string; value?: string }

      if (typeof key !== "string" || !KEY_RE.test(key)) {
        return res.status(400).json({ error: "Invalid key. Use UPPER_SNAKE_CASE letters, digits, underscores." })
      }
      if (typeof value !== "string") {
        return res.status(400).json({ error: "Value must be a string." })
      }
      if (value.length > 8192) {
        return res.status(413).json({ error: "Value exceeds 8 KB limit." })
      }

      const current = await readEnvFile()
      const next    = upsertEnv(current, key, value)
      await writeEnvFile(next)

      // Update the live process env so subsequent requests in this Node instance see it.
      // (A full restart is still required for some libraries that snapshot env at boot.)
      process.env[key] = value

      return res.status(200).json({ ok: true, key, value })
    }

    res.setHeader("Allow", "GET, PUT")
    return res.status(405).json({ error: "Method not allowed" })
  } catch (err) {
    console.error("[env-api]", err)
    return res.status(500).json({ error: "Internal error" })
  }
}
