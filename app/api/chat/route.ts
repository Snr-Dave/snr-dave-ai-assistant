import { streamText, convertToModelMessages, tool } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { Octokit } from "@octokit/rest"
import { z } from "zod"

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
})

function getOctokit() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set")
  return new Octokit({ auth: process.env.GITHUB_TOKEN })
}

const githubTools = {
  readFile: tool({
    description: "Read the content of a file from a GitHub repository owned by Snr-Dave.",
    parameters: z.object({
      repo: z.string().describe("Repository name (without owner prefix), e.g. 'my-project'"),
      path: z.string().describe("File path within the repository, e.g. 'src/index.ts'"),
      branch: z.string().optional().describe("Branch name (defaults to the repo default branch)"),
    }),
    execute: async ({ repo, path, branch }) => {
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
        const message = err instanceof Error ? err.message : String(err)
        return { error: `Failed to read file: ${message}` }
      }
    },
  }),

  createBranch: tool({
    description: "Create a new branch in a GitHub repository owned by Snr-Dave.",
    parameters: z.object({
      repo: z.string().describe("Repository name (without owner prefix)"),
      branch: z.string().describe("Name for the new branch"),
      fromBranch: z.string().optional().describe("Source branch to create from (defaults to default branch)"),
    }),
    execute: async ({ repo, branch, fromBranch }) => {
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
        const message = err instanceof Error ? err.message : String(err)
        return { error: `Failed to create branch: ${message}` }
      }
    },
  }),

  commitFile: tool({
    description: "Create or update a file in a GitHub repository owned by Snr-Dave by committing a change.",
    parameters: z.object({
      repo: z.string().describe("Repository name (without owner prefix)"),
      path: z.string().describe("File path to create or update"),
      content: z.string().describe("New file content (plain text)"),
      message: z.string().describe("Commit message"),
      branch: z.string().describe("Branch to commit to"),
    }),
    execute: async ({ repo, path, content, message, branch }) => {
      try {
        const octokit = getOctokit()
        let sha: string | undefined
        try {
          const existing = await octokit.repos.getContent({
            owner: "Snr-Dave",
            repo,
            path,
            ref: branch,
          })
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
        return {
          success: true,
          commitSha: result.data.commit.sha,
          url: result.data.content?.html_url,
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: `Failed to commit file: ${message}` }
      }
    },
  }),
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    console.log("[v0] Chat API called with", messages.length, "messages")

    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: `You are Snr-Dave's personal AI assistant embedded in a Command Center dashboard.
You have direct access to tools that can read files, create branches, and commit changes to any repository in the Snr-Dave GitHub account.
When asked to make code changes, always: read the file first, explain what you will change, create a branch if needed, then commit.
Be concise, technical when needed, and friendly. Use markdown formatting when helpful.`,
      messages: await convertToModelMessages(messages),
      tools: githubTools,
      maxSteps: 10,
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
      JSON.stringify({ status: "ok", model: "gemini-2.0-flash" }),
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
