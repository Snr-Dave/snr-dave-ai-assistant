import { streamText, convertToModelMessages, tool, jsonSchema } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { Octokit } from "@octokit/rest"
import _sodium from "libsodium-wrappers"

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
})

function getOctokit() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set")
  return new Octokit({ auth: process.env.GITHUB_TOKEN })
}

async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
  await _sodium.ready
  const sodium = _sodium
  const key = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL)
  const message = sodium.from_string(secretValue)
  const encrypted = sodium.crypto_box_seal(message, key)
  return sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)
}

// ─── Input types ───────────────────────────────────────────────────────────────

type ReadFileInput        = { repo: string; path: string; branch?: string }
type CreateBranchInput    = { repo: string; branch: string; fromBranch?: string }
type CommitFileInput      = { repo: string; path: string; content: string; message: string; branch: string }
type GetRepoSettingsInput = { repo: string }
type SetRepoSecretInput   = { repo: string; secretName: string; secretValue: string }
type ManageActionsInput   = { repo: string; workflowFile: string; content: string; branch: string; message?: string }
type CreatePRInput        = { repo: string; title: string; head: string; base: string; body?: string }
type MergePRInput         = { repo: string; prNumber: number; mergeMethod?: "merge" | "squash" | "rebase"; commitTitle?: string }
type MergeBranchesInput   = { repo: string; base: string; head: string; message?: string }

// ─── Tools ─────────────────────────────────────────────────────────────────────

const githubTools = {

  // ── Existing: File & Branch ──────────────────────────────────────────────────

  readFile: tool<ReadFileInput, { content: string; sha: string; path: string } | { error: string }>({
    description: "Read the content of a file from a GitHub repository owned by Snr-Dave.",
    inputSchema: jsonSchema<ReadFileInput>({
      type: "object",
      properties: {
        repo:   { type: "string", description: "Repository name (without owner prefix), e.g. 'my-project'" },
        path:   { type: "string", description: "File path within the repository, e.g. 'src/index.ts'" },
        branch: { type: "string", description: "Branch name (defaults to the repo default branch)" },
      },
      required: ["repo", "path"],
    }),
    execute: async ({ repo, path, branch }: ReadFileInput) => {
      try {
        const octokit = getOctokit()
        const response = await octokit.repos.getContent({
          owner: "Snr-Dave",
          repo,
          path,
          ...(branch ? { ref: branch } : {}),
        })
        const data = response.data
        if (Array.isArray(data)) return { error: `${path} is a directory, not a file` }
        if (data.type !== "file") return { error: `${path} is not a file` }
        const content = Buffer.from(data.content, "base64").toString("utf-8")
        return { content, sha: data.sha, path: data.path }
      } catch (err: unknown) {
        return { error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  createBranch: tool<CreateBranchInput, { success: boolean; branch: string; basedOn: string } | { error: string }>({
    description: "Create a new branch in a GitHub repository owned by Snr-Dave.",
    inputSchema: jsonSchema<CreateBranchInput>({
      type: "object",
      properties: {
        repo:       { type: "string", description: "Repository name (without owner prefix)" },
        branch:     { type: "string", description: "Name for the new branch" },
        fromBranch: { type: "string", description: "Source branch to create from (defaults to default branch)" },
      },
      required: ["repo", "branch"],
    }),
    execute: async ({ repo, branch, fromBranch }: CreateBranchInput) => {
      try {
        const octokit = getOctokit()
        const repoData = await octokit.repos.get({ owner: "Snr-Dave", repo })
        const baseBranch = fromBranch || repoData.data.default_branch
        const refData = await octokit.git.getRef({
          owner: "Snr-Dave",
          repo,
          ref: `heads/${baseBranch}`,
        })
        await octokit.git.createRef({
          owner: "Snr-Dave",
          repo,
          ref: `refs/heads/${branch}`,
          sha: refData.data.object.sha,
        })
        return { success: true, branch, basedOn: baseBranch }
      } catch (err: unknown) {
        return { error: `Failed to create branch: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  commitFile: tool<CommitFileInput, { success: boolean; commitSha: string | undefined; url: string | undefined } | { error: string }>({
    description: "Create or update a file in a GitHub repository owned by Snr-Dave by committing a change.",
    inputSchema: jsonSchema<CommitFileInput>({
      type: "object",
      properties: {
        repo:    { type: "string", description: "Repository name (without owner prefix)" },
        path:    { type: "string", description: "File path to create or update" },
        content: { type: "string", description: "New file content (plain text)" },
        message: { type: "string", description: "Commit message" },
        branch:  { type: "string", description: "Branch to commit to" },
      },
      required: ["repo", "path", "content", "message", "branch"],
    }),
    execute: async ({ repo, path, content, message, branch }: CommitFileInput) => {
      try {
        const octokit = getOctokit()
        let sha: string | undefined
        try {
          const existing = await octokit.repos.getContent({ owner: "Snr-Dave", repo, path, ref: branch })
          const data = existing.data
          if (!Array.isArray(data) && data.type === "file") sha = data.sha
        } catch {
          // File does not exist yet — sha stays undefined
        }
        const encoded = Buffer.from(content, "utf-8").toString("base64")
        const result = await octokit.repos.createOrUpdateFileContents({
          owner: "Snr-Dave",
          repo,
          path,
          message,
          content: encoded,
          branch,
          ...(sha ? { sha } : {}),
        })
        return { success: true, commitSha: result.data.commit.sha, url: result.data.content?.html_url }
      } catch (err: unknown) {
        return { error: `Failed to commit file: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  // ── Settings Tools ───────────────────────────────────────────────────────────

  getRepoSettings: tool<
    GetRepoSettingsInput,
    { fullName: string; visibility: string; defaultBranch: string; topics: string[]; isPrivate: boolean } | { error: string }
  >({
    description: "Fetch repository settings including visibility, topics, and default branch for a Snr-Dave repo.",
    inputSchema: jsonSchema<GetRepoSettingsInput>({
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name (without owner prefix)" },
      },
      required: ["repo"],
    }),
    execute: async ({ repo }: GetRepoSettingsInput) => {
      try {
        const octokit = getOctokit()
        const { data } = await octokit.repos.get({ owner: "Snr-Dave", repo })
        return {
          fullName:      data.full_name,
          visibility:    data.visibility ?? (data.private ? "private" : "public"),
          defaultBranch: data.default_branch,
          topics:        data.topics ?? [],
          isPrivate:     data.private,
        }
      } catch (err: unknown) {
        return { error: `Failed to fetch repo settings: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  setRepoSecret: tool<
    SetRepoSecretInput,
    { success: boolean; secretName: string; note: string } | { error: string }
  >({
    description: "Create or overwrite a GitHub Actions secret in a Snr-Dave repository. The secret value is encrypted client-side before being sent to GitHub.",
    inputSchema: jsonSchema<SetRepoSecretInput>({
      type: "object",
      properties: {
        repo:        { type: "string", description: "Repository name (without owner prefix)" },
        secretName:  { type: "string", description: "Name of the secret (e.g. API_KEY). Must be uppercase with underscores." },
        secretValue: { type: "string", description: "Plain-text value of the secret to store." },
      },
      required: ["repo", "secretName", "secretValue"],
    }),
    execute: async ({ repo, secretName, secretValue }: SetRepoSecretInput) => {
      try {
        const octokit = getOctokit()
        const { data: keyData } = await octokit.actions.getRepoPublicKey({ owner: "Snr-Dave", repo })
        const encryptedValue = await encryptSecret(keyData.key, secretValue)
        await octokit.actions.createOrUpdateRepoSecret({
          owner:           "Snr-Dave",
          repo,
          secret_name:     secretName,
          encrypted_value: encryptedValue,
          key_id:          keyData.key_id,
        })
        return {
          success:    true,
          secretName,
          note: "⚠️ Secret successfully written. Note: GitHub Actions secrets are write-only — this tool can create or overwrite secrets but cannot read or retrieve their values.",
        }
      } catch (err: unknown) {
        return { error: `Failed to set secret: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  manageActions: tool<
    ManageActionsInput,
    { success: boolean; commitSha: string | undefined; url: string | undefined; workflowPath: string } | { error: string }
  >({
    description: "Create or update a GitHub Actions workflow YAML file in .github/workflows/ of a Snr-Dave repository.",
    inputSchema: jsonSchema<ManageActionsInput>({
      type: "object",
      properties: {
        repo:         { type: "string", description: "Repository name (without owner prefix)" },
        workflowFile: { type: "string", description: "Filename for the workflow, e.g. 'deploy.yml' (placed in .github/workflows/)" },
        content:      { type: "string", description: "Full YAML content of the GitHub Actions workflow" },
        branch:       { type: "string", description: "Branch to commit the workflow file to" },
        message:      { type: "string", description: "Commit message (optional)" },
      },
      required: ["repo", "workflowFile", "content", "branch"],
    }),
    execute: async ({ repo, workflowFile, content, branch, message }: ManageActionsInput) => {
      try {
        const octokit = getOctokit()
        const workflowPath = `.github/workflows/${workflowFile}`
        const commitMessage = message ?? `ci: update ${workflowFile} workflow`
        let sha: string | undefined
        try {
          const existing = await octokit.repos.getContent({ owner: "Snr-Dave", repo, path: workflowPath, ref: branch })
          const data = existing.data
          if (!Array.isArray(data) && data.type === "file") sha = data.sha
        } catch {
          // Workflow file does not exist yet
        }
        const encoded = Buffer.from(content, "utf-8").toString("base64")
        const result = await octokit.repos.createOrUpdateFileContents({
          owner:   "Snr-Dave",
          repo,
          path:    workflowPath,
          message: commitMessage,
          content: encoded,
          branch,
          ...(sha ? { sha } : {}),
        })
        return {
          success:      true,
          commitSha:    result.data.commit.sha,
          url:          result.data.content?.html_url,
          workflowPath,
        }
      } catch (err: unknown) {
        return { error: `Failed to manage workflow: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  // ── PR & Merge Tools ─────────────────────────────────────────────────────────

  createPullRequest: tool<
    CreatePRInput,
    { success: boolean; prNumber: number; url: string; title: string } | { error: string }
  >({
    description: "Open a pull request between two branches in a Snr-Dave GitHub repository.",
    inputSchema: jsonSchema<CreatePRInput>({
      type: "object",
      properties: {
        repo:  { type: "string", description: "Repository name (without owner prefix)" },
        title: { type: "string", description: "Title of the pull request" },
        head:  { type: "string", description: "The branch containing the changes (source branch)" },
        base:  { type: "string", description: "The branch to merge into (target branch, e.g. 'main')" },
        body:  { type: "string", description: "Description / body of the pull request (optional)" },
      },
      required: ["repo", "title", "head", "base"],
    }),
    execute: async ({ repo, title, head, base, body }: CreatePRInput) => {
      try {
        const octokit = getOctokit()
        const { data } = await octokit.pulls.create({
          owner: "Snr-Dave",
          repo,
          title,
          head,
          base,
          body: body ?? "",
        })
        return { success: true, prNumber: data.number, url: data.html_url, title: data.title }
      } catch (err: unknown) {
        return { error: `Failed to create pull request: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  mergePullRequest: tool<
    MergePRInput,
    { success: boolean; merged: boolean; sha: string | undefined; message: string } | { error: string }
  >({
    description: "Merge an open pull request by its PR number in a Snr-Dave repository. This is a destructive action — always confirm the PR number and merge method before proceeding.",
    inputSchema: jsonSchema<MergePRInput>({
      type: "object",
      properties: {
        repo:        { type: "string", description: "Repository name (without owner prefix)" },
        prNumber:    { type: "number", description: "Pull request number to merge" },
        mergeMethod: { type: "string", enum: ["merge", "squash", "rebase"], description: "Merge strategy: 'merge', 'squash', or 'rebase' (defaults to 'merge')" },
        commitTitle: { type: "string", description: "Custom commit title for the merge commit (optional)" },
      },
      required: ["repo", "prNumber"],
    }),
    execute: async ({ repo, prNumber, mergeMethod, commitTitle }: MergePRInput) => {
      try {
        const octokit = getOctokit()
        const { data } = await octokit.pulls.merge({
          owner:        "Snr-Dave",
          repo,
          pull_number:  prNumber,
          merge_method: mergeMethod ?? "merge",
          ...(commitTitle ? { commit_title: commitTitle } : {}),
        })
        return {
          success: true,
          merged:  data.merged,
          sha:     data.sha,
          message: data.message,
        }
      } catch (err: unknown) {
        return { error: `Failed to merge pull request: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),

  mergeBranches: tool<
    MergeBranchesInput,
    { success: boolean; sha: string; commitMessage: string } | { alreadyMerged: true; message: string } | { error: string }
  >({
    description: "Directly merge one branch into another in a Snr-Dave repository without a PR. Useful for syncing branches. This is a destructive action — confirm the base and head branches before proceeding.",
    inputSchema: jsonSchema<MergeBranchesInput>({
      type: "object",
      properties: {
        repo:    { type: "string", description: "Repository name (without owner prefix)" },
        base:    { type: "string", description: "Branch to merge INTO (the receiving branch, e.g. 'main')" },
        head:    { type: "string", description: "Branch to merge FROM (the source branch)" },
        message: { type: "string", description: "Custom merge commit message (optional)" },
      },
      required: ["repo", "base", "head"],
    }),
    execute: async ({ repo, base, head, message }: MergeBranchesInput) => {
      try {
        const octokit = getOctokit()
        const response = await octokit.repos.merge({
          owner:          "Snr-Dave",
          repo,
          base,
          head,
          ...(message ? { commit_message: message } : {}),
        })
        // GitHub returns 204 No Content when head is already merged into base.
        // Octokit types this as 201, so we check data presence instead.
        if (!response.data?.sha) {
          return { alreadyMerged: true, message: `${head} is already fully merged into ${base}.` }
        }
        return {
          success:       true,
          sha:           response.data.sha,
          commitMessage: response.data.commit.message,
        }
      } catch (err: unknown) {
        return { error: `Failed to merge branches: ${err instanceof Error ? err.message : String(err)}` }
      }
    },
  }),
}

// ─── Route handlers ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    console.log("[v0] Chat API called with", messages.length, "messages")

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: `You are a DevOps & Security Specialist embedded in Snr-Dave's personal Command Center dashboard.

You have direct access to tools that can:
- Read files and commit changes to any Snr-Dave GitHub repository
- Create and manage branches
- Fetch repository settings (visibility, topics, default branch)
- Create or overwrite GitHub Actions secrets (write-only — secrets cannot be read back)
- Create and update CI/CD workflow YAML files in .github/workflows/
- Open pull requests between branches
- Merge pull requests by PR number
- Directly merge branches without a PR

Always prioritize security and best practices:
- Before executing any destructive action (merging branches, merging a PR, overwriting a secret), clearly explain what will happen and ask for confirmation unless the user has already confirmed.
- When writing workflow files, ensure secrets are referenced via \${{ secrets.NAME }} and never hardcoded.
- When asked to make code changes, always: read the file first, explain what you will change, then commit.
- Use markdown formatting in responses. Be concise, technical when needed, and direct.`,
      messages: await convertToModelMessages(messages),
      tools: githubTools,
    })

    console.log("[v0] Stream created successfully")
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

export async function GET() {
  try {
    console.log("[v0] Chat API health check")
    return new Response(
      JSON.stringify({ status: "ok", model: "gemini-2.5-flash" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("[v0] Health check error:", error)
    return new Response(
      JSON.stringify({ status: "error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
