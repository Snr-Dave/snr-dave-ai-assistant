"use client"

import useSWR from "swr"
import {
  Folder, ExternalLink, Circle, Star, GitFork,
  Loader2, AlertCircle, RefreshCw,
} from "lucide-react"

interface GitHubRepo {
  id:               number
  name:             string
  full_name:        string
  description:      string | null
  html_url:         string
  homepage:         string | null
  language:         string | null
  stargazers_count: number
  forks_count:      number
  pushed_at:        string
  updated_at:       string
  archived:         boolean
  fork:             boolean
  private:          boolean
}

const fetcher = async (url: string): Promise<GitHubRepo[]> => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

function getLanguageColor(language: string | null): string {
  const colors: Record<string, string> = {
    TypeScript: "bg-blue-400",
    JavaScript: "bg-yellow-400",
    Python:     "bg-green-400",
    Rust:       "bg-orange-400",
    Go:         "bg-cyan-400",
    Java:       "bg-red-400",
    CSS:        "bg-purple-400",
    HTML:       "bg-orange-500",
    Shell:      "bg-emerald-400",
    Ruby:       "bg-rose-400",
  }
  return colors[language || ""] || "bg-gray-400"
}

function ProjectCard({ repo }: { repo: GitHubRepo }) {
  return (
    <div className="group relative flex flex-col p-4 bg-card rounded-lg border border-border
                    hover:border-accent/50 hover:shadow-[0_0_0_1px_rgba(0,217,255,0.15)]
                    transition-all duration-200">

      {/* Top-right Open on GitHub link — always visible, accent on hover */}
      <a
        href={repo.html_url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open on GitHub"
        aria-label={`Open ${repo.name} on GitHub`}
        className="absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-md
                   text-muted-foreground hover:text-accent hover:bg-accent/10
                   border border-transparent hover:border-accent/30 transition-all z-10"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>

      {/* Header: icon + name + badges (right-padded so it doesn't overlap the link) */}
      <div className="flex items-start gap-2.5 mb-3 pr-8">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent/10
                        group-hover:bg-accent/20 transition-colors flex-shrink-0">
          <Folder className="w-4 h-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground group-hover:text-accent
                         transition-colors break-all leading-tight">
            {repo.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {repo.private && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded
                               bg-accent/10 text-accent border border-accent/30">
                Private
              </span>
            )}
            {repo.archived && (
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                Archived
              </span>
            )}
            {repo.fork && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px]
                               rounded bg-muted text-muted-foreground">
                <GitFork className="w-2.5 h-2.5" /> Fork
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2.25rem]">
        {repo.description || "No description available"}
      </p>

      {/* Footer: language + stars + forks */}
      <div className="mt-auto flex items-center gap-3 text-[11px] text-muted-foreground">
        {repo.language ? (
          <span className="flex items-center gap-1.5">
            <Circle className={`w-2 h-2 ${getLanguageColor(repo.language)}`} style={{ fill: "currentColor" }} />
            {repo.language}
          </span>
        ) : (
          <span className="text-muted-foreground/50">No language</span>
        )}
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3" />
          {repo.stargazers_count}
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="w-3 h-3" />
          {repo.forks_count}
        </span>
      </div>
    </div>
  )
}

export function ProjectsGrid() {
  const { data: repos, error, isLoading, isValidating, mutate } = useSWR<GitHubRepo[]>(
    "/api/github/repos",
    fetcher,
    {
      refreshInterval:        300_000,  // background poll every 5 min
      revalidateOnFocus:      false,
      keepPreviousData:       true,
    },
  )

  const list      = repos ?? []
  const refreshing = isValidating && !isLoading

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 flex-shrink-0">
            <Folder className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Projects</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Loading…"
                : error
                  ? "Failed to load"
                  : `${list.length} ${list.length === 1 ? "repository" : "repositories"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isLoading || refreshing}
            title="Refresh repositories"
            aria-label="Refresh repositories"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                       text-muted-foreground hover:text-accent hover:bg-accent/10
                       border border-transparent hover:border-accent/30
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || refreshing) ? "animate-spin text-accent" : ""}`} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
          <a
            href="https://github.com/Snr-Dave?tab=repositories"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 text-xs text-accent hover:bg-accent/10 rounded-md transition-colors"
          >
            View all
          </a>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-foreground mb-1">Failed to load repositories</p>
            <p className="text-xs text-muted-foreground break-all">{(error as Error).message}</p>
            <button
              type="button"
              onClick={() => mutate()}
              className="mt-3 px-3 py-1.5 text-xs font-medium rounded-md
                         text-accent border border-accent/30 hover:bg-accent/10 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && list.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Folder className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No repositories found</p>
          </div>
        )}

        {!isLoading && !error && list.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((repo) => (
              <ProjectCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
