"use client"

import useSWR from "swr"
import { GitBranch, GitCommit, GitPullRequest, Star, Eye, GitFork, ExternalLink, Loader2, AlertCircle } from "lucide-react"

interface GitHubEvent {
  id: string
  type: string
  repo: {
    name: string
    url: string
  }
  created_at: string
  payload: {
    action?: string
    ref?: string
    ref_type?: string
    commits?: Array<{ sha: string; message: string }>
    pull_request?: { title: string; number: number }
    issue?: { title: string; number: number }
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function getEventIcon(type: string) {
  switch (type) {
    case "PushEvent":
      return <GitCommit className="w-4 h-4" />
    case "PullRequestEvent":
      return <GitPullRequest className="w-4 h-4" />
    case "CreateEvent":
      return <GitBranch className="w-4 h-4" />
    case "WatchEvent":
      return <Star className="w-4 h-4" />
    case "ForkEvent":
      return <GitFork className="w-4 h-4" />
    default:
      return <Eye className="w-4 h-4" />
  }
}

function getEventDescription(event: GitHubEvent): string {
  const { type, payload, repo } = event
  const repoName = repo.name.split("/")[1] || repo.name

  switch (type) {
    case "PushEvent":
      const commitCount = payload.commits?.length || 0
      return `Pushed ${commitCount} commit${commitCount !== 1 ? "s" : ""} to ${repoName}`
    case "PullRequestEvent":
      return `${payload.action} PR #${payload.pull_request?.number} in ${repoName}`
    case "CreateEvent":
      return `Created ${payload.ref_type} ${payload.ref || ""} in ${repoName}`
    case "WatchEvent":
      return `Starred ${repoName}`
    case "ForkEvent":
      return `Forked ${repoName}`
    case "IssuesEvent":
      return `${payload.action} issue #${payload.issue?.number} in ${repoName}`
    default:
      return `Activity in ${repoName}`
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

export function GitHubFeed() {
  const { data, error, isLoading } = useSWR<GitHubEvent[]>(
    "/api/github/events",
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  )

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
            <GitBranch className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">GitHub Activity</h2>
            <p className="text-xs text-muted-foreground">@Snr-Dave</p>
          </div>
        </div>
        <a
          href="https://github.com/Snr-Dave"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="View GitHub Profile"
        >
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load activity</p>
          </div>
        ) : data && data.length > 0 ? (
          <ul className="divide-y divide-border">
            {data.map((event) => (
              <li key={event.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {getEventDescription(event)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTimeAgo(event.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <GitBranch className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  )
}
