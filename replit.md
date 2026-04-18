# Snr-Dave AI Assistant — Command Center

Personal AI-powered dashboard with real-time chat, GitHub activity feed, and project portfolio. Built with Next.js 16 App Router and Vercel AI SDK v6.

## Architecture

- **Framework**: Next.js 16.2.4 (App Router, Turbopack)
- **AI**: Vercel AI SDK v6 (`ai@6.0.168`) + `@ai-sdk/google` → Gemini 2.5 Flash
- **GitHub**: Octokit REST (`@octokit/rest`) for AI agent tools
- **Styling**: Tailwind CSS v4 — Deep Charcoal + Electric Cyan theme
- **Data fetching**: SWR for client-side GitHub data
- **Port**: 5000 (`next dev -p 5000 -H 0.0.0.0`)

## Key Files

| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | AI chat endpoint — Gemini 2.5 Flash + GitHub tools |
| `app/api/github/events/route.ts` | Proxies GitHub events API with GITHUB_TOKEN |
| `app/api/github/repos/route.ts` | Proxies GitHub repos API with GITHUB_TOKEN |
| `components/chat-window.tsx` | AI chat UI with streaming and send-button spinner |
| `components/system-status.tsx` | Live status bar for API/AI/GitHub health |
| `components/github-feed.tsx` | Real-time GitHub activity feed |
| `components/projects-grid.tsx` | Live GitHub repositories grid |
| `next.config.ts` | Includes `allowedDevOrigins` for Replit HMR support |

## Environment Secrets Required

| Secret | Purpose |
|--------|---------|
| `GOOGLE_API_KEY` | Google AI Studio key for Gemini 2.5 Flash |
| `GITHUB_TOKEN` | GitHub PAT for authenticated API calls and AI agent tools |

## AI GitHub Agent Tools (DevOps & Security Specialist)

The assistant has 9 tools across three categories. All run server-side via Octokit + `GITHUB_TOKEN`. Secret encryption uses `libsodium-wrappers` (`crypto_box_seal`).

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

## AI SDK v6 Notes

- Tool definitions use `inputSchema` (not `parameters`) — field was renamed in v6
- Tool generics must be explicit: `tool<InputType, OutputType>({...})`
- Use `jsonSchema<T>()` from `ai` for schema definitions — avoids Zod version conflicts
- `maxSteps` is not available in `streamText` with the messages overload in v6
- GitHub data routes use server-side token injection to avoid rate limits

## Running

```bash
npm install
npm run dev   # starts on http://0.0.0.0:5000
```
