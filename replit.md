# Snr-Dave AI Assistant — Command Center

Personal AI-powered dashboard with real-time chat, GitHub activity feed, project portfolio, an embedded bash console, and an in-app `.env` manager. Built with Next.js 16 App Router and Vercel AI SDK v6.

## Architecture

- **Framework**: Next.js 16.2.4 (App Router + Pages Router for Socket.IO, Turbopack)
- **AI**: Vercel AI SDK v6 (`ai@6.0.168`) + `@ai-sdk/google` → Gemini 2.5 Flash
- **GitHub**: Octokit REST (`@octokit/rest`) for AI agent tools
- **Terminal**: `xterm.js` + `@xterm/addon-fit` on the client, `socket.io` + `child_process.spawn('/bin/bash', ['-i'])` on the server
- **Styling**: Tailwind CSS v4 — Deep Charcoal (`#0a0a0a` / `#0f0f0f`) + Electric Cyan (`#00d9ff`)
- **Data fetching**: SWR for client-side GitHub data
- **Port**: 5000 (`next dev -p 5000 -H 0.0.0.0`)

## Key Files

| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | AI chat endpoint — Gemini + 9 GitHub tools + shell-bridge prompt |
| `app/api/github/events/route.ts` | Proxies GitHub events API with `GITHUB_TOKEN` |
| `app/api/github/repos/route.ts` | Proxies GitHub repos API with `GITHUB_TOKEN` |
| `app/layout.tsx` | Root layout — imports `@xterm/xterm/css/xterm.css` (Turbopack-safe location) |
| `pages/api/terminal/shell.ts` | Lazy Socket.IO server at `/api/terminal/socket.io`; spawns bash, pipes stdio, SIGHUP on disconnect |
| `pages/api/settings/env.ts` | `GET` / `PUT` for `.env` with format-preserving upsert + key validation |
| `components/chat-window.tsx` | AI chat UI; AI SDK v6 tool detection (`tool-{name}` parts) |
| `components/system-status.tsx` | Live status bar for API / AI / GitHub health |
| `components/github-feed.tsx` | Real-time GitHub activity feed |
| `components/projects-grid.tsx` | Live GitHub repositories grid |
| `components/dashboard-header.tsx` | Top bar; opens `SettingsPanel` and owns `activeTab` state (`TabId`) |
| `components/settings-panel.tsx` | Right slide-over with **System Console** + **Environment** tabs; owns full-height state |
| `components/dashboard-terminal.tsx` | Terminal header — font-size A−/A+ (10–20), Copy, Clear, Full-Height toggle |
| `components/xterm-core.tsx` | xterm.js + Socket.IO client; `forwardRef` exposes `clear` / `copySelection` / `setFontSize` |
| `components/environment-manager.tsx` | `.env` editor — masked rows, eye toggle, `+ Add Secret` drafts with key validation |
| `lib/shell-tool.ts` | AI Shell Bridge Phase 1 — `formatBashExec`, `parseBashExec`, `SHELL_PROMPT_FRAGMENT` |
| `next.config.ts` | `allowedDevOrigins` for Replit HMR support |

## Environment Secrets

| Secret | Purpose |
|--------|---------|
| `GOOGLE_API_KEY` | Google AI Studio key for Gemini 2.5 Flash |
| `GITHUB_TOKEN` | GitHub PAT for authenticated API calls and AI agent tools |

Replit secrets take precedence over `.env`. The Settings → Environment tab manages `.env` only — for Replit-injected secrets use the Replit Secrets panel.

## AI GitHub Agent Tools (DevOps & Security Specialist)

9 tools across three categories. All run server-side via Octokit + `GITHUB_TOKEN`. Secret encryption uses `libsodium-wrappers` (`crypto_box_seal`).

**File & Branch**
- `readFile` — Read any file from any `Snr-Dave` repo at any ref
- `createBranch` — Create a new branch from a specified base
- `commitFile` — Create or update a file and commit it to a branch

**Settings**
- `getRepoSettings` — Fetch visibility, topics, and default branch
- `setRepoSecret` — Create/overwrite a GitHub Actions secret (write-only; cannot read values back)
- `manageActions` — Create or update workflow YAML files in `.github/workflows/`

**PR & Merge**
- `createPullRequest` — Open a PR between two branches
- `mergePullRequest` — Merge an open PR by number (merge/squash/rebase)
- `mergeBranches` — Direct branch sync via `repos.merge` without a PR

## System Console (xterm + bash bridge)

- `pages/api/terminal/shell.ts` lazy-initialises a Socket.IO server (`io` cached on `res.socket.server.io`) at `path: /api/terminal/socket.io`. Each client connection spawns `/bin/bash -i` with `cwd=/home/runner/workspace`, `TERM=xterm-256color`, and a custom `PS1`. Stdout + stderr → client `output` events; client `input` → child stdin. Disconnect sends `SIGHUP`.
- `xterm-core.tsx` is dynamically imported with `ssr: false` (xterm touches `window` on construct). The `TerminalHandle` ref exposes `clear()`, `copySelection()`, and `setFontSize(n)` — the latter mutates `term.options.fontSize` then refits via `requestAnimationFrame`.
- xterm CSS is imported in `app/layout.tsx`, NOT in `globals.css` — Turbopack rejects `@import` of node_modules from a CSS entrypoint.
- The Full-Height toggle lives on `SettingsPanel`. When active, the panel becomes full-viewport (`left-0 max-w-none border-l-0`), header + tab bar + backdrop collapse, and Escape exits full-height before closing. The toggle is only rendered for the Console tab — auto-collapses if the user switches to Environment.

## Environment Manager (`/api/settings/env`)

- **GET** parses `.env` line-by-line, strips surrounding quotes, validates keys against `^[A-Z_][A-Z0-9_]*$`, and merges with a seeded list (`GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_API_KEY`, `GITHUB_TOKEN`, `SESSION_SECRET`) so the UI is useful out-of-the-box.
- **PUT** `{ key, value }` validates the key, caps `value` at 8 KB, auto-quotes values containing whitespace / `#` / `=` / `"` / `'` (with backslash escaping), preserves comments / blank lines / indentation / unrelated entries, appends new keys at end, and mirrors the update into `process.env` for the live Node instance. The `.env` file is written with mode `0600`.
- The UI shows existing rows with masked password inputs + eye toggle + per-row Save (`⌘/Ctrl + Enter`) + green "Saved" pill that auto-fades after 2.5 s. **+ Add Secret** appends a draft row with an editable, validated, auto-uppercased key field — Save is disabled until the key matches the regex and is unique.

## AI Shell Bridge (Phase 1)

`lib/shell-tool.ts` provides:
- `formatBashExec(command)` — wraps a command in a ```` ```bash-exec ```` fence
- `parseBashExec(text)` — extracts every `bash-exec` block with start/end offsets
- `hasBashExec(text)` — fast boolean check
- `SHELL_PROMPT_FRAGMENT` — the canonical instruction appended to the chat system prompt teaching Gemini to emit shell commands inside `bash-exec` blocks (one logical command per block, no destructive commands without confirmation, prefer non-interactive flags, warn on long-running commands)

Phase 2 (future): chat UI parses `bash-exec` blocks, renders a "Run in Console" button, pushes the command to the active terminal socket.

## AI SDK v6 Notes

- Tool definitions use `inputSchema` (not `parameters`) — field was renamed in v6
- Tool generics must be explicit: `tool<InputType, OutputType>({...})`
- Use `jsonSchema<T>()` from `ai` for schema definitions — avoids Zod version conflicts
- Tool-call message parts use type `tool-{name}` with states `input-streaming` / `input-available` (chat-window detects via this prefix)
- `maxSteps` is not available in `streamText` with the messages overload in v6
- GitHub data routes use server-side token injection to avoid rate limits

## Running

```bash
npm install
npm run dev   # starts on http://0.0.0.0:5000
```

Open the dashboard, click the gear icon in the header to access **System Console** (live bash) and **Environment** (`.env` editor).
