/**
 * Shell-tool utilities — Phase 1 of the AI Shell Bridge.
 *
 * The AI assistant emits shell commands inside fenced code blocks tagged
 * `bash-exec`. The dashboard chat UI can detect these blocks and route them
 * to the live System Console (xterm + bash bridge) for the user to review
 * and execute.
 *
 * Phase 1 scope: format/parse helpers + the canonical prompt fragment.
 * Phase 2 (future): an `execute` button in chat that pushes the command to
 * the terminal socket via `pages/api/terminal/shell.ts`.
 */

export const BASH_EXEC_LANG = "bash-exec" as const

/** Regex matching ```bash-exec … ``` fenced blocks (multi-line, lazy). */
const BASH_EXEC_RE = /```bash-exec\s*\n([\s\S]*?)```/g

export interface BashExecBlock {
  /** Raw command text (one or more lines, trimmed of trailing whitespace). */
  command: string
  /** 0-indexed character offset in the source where the fence opened. */
  start:   number
  /** 0-indexed character offset where the closing fence ends. */
  end:     number
}

/** Wrap a shell command in a `bash-exec` fenced code block. */
export function formatBashExec(command: string): string {
  const trimmed = command.replace(/\s+$/, "")
  return ["```bash-exec", trimmed, "```"].join("\n")
}

/** Extract every `bash-exec` block from a markdown / chat text payload. */
export function parseBashExec(text: string): BashExecBlock[] {
  const out: BashExecBlock[] = []
  for (const m of text.matchAll(BASH_EXEC_RE)) {
    if (m.index === undefined) continue
    out.push({
      command: m[1].replace(/\s+$/, ""),
      start:   m.index,
      end:     m.index + m[0].length,
    })
  }
  return out
}

/** True when the text contains at least one `bash-exec` block. */
export function hasBashExec(text: string): boolean {
  BASH_EXEC_RE.lastIndex = 0
  return BASH_EXEC_RE.test(text)
}

/**
 * Canonical prompt fragment teaching the LLM how to use the System Console.
 * Append this to any system prompt that should be shell-aware.
 */
export const SHELL_PROMPT_FRAGMENT = `
## System Console (live bash shell)

The user has a live, interactive bash shell available in the dashboard's
Settings → System Console panel. It runs in the project workspace
(\`/home/runner/workspace\`) and shares the same filesystem as the app.

**You can execute commands directly via the \`executeBash\` tool.** Output
streams live to the user's System Console (so they watch the work happen) and
the captured stdout/stderr come back as the tool result so you can verify
what happened and decide next steps.

When you intend to show the command before running it (for explanation or
confirmation), wrap it in a fenced code block tagged \`bash-exec\`. Plain
\`bash\` blocks are treated as read-only examples.

Rules:
- One logical command per \`executeBash\` call (chain with \`&&\` or \`;\` if needed).
- For destructive commands (\`rm -rf\`, \`git reset --hard\`, \`git push --force\`,
  \`DROP TABLE\`, etc.), first explain the impact in prose, ask the user to
  confirm, and only call \`executeBash\` after they agree.
- Prefer non-interactive flags (\`--yes\`, \`--non-interactive\`, \`-y\`) — there
  is no human at the prompt during execution.
- For long-running commands (dev servers, watchers), warn the user and prefer
  short-lived alternatives (\`npm run build\` rather than \`npm run dev\`).
- After execution, check \`exitCode\` and \`stderr\` and report the outcome
  honestly — do not claim success on a non-zero exit.

Example narration:

\`\`\`bash-exec
git status --short
\`\`\`

…then call \`executeBash({ command: "git status --short" })\`.
`.trim()
