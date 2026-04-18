"use client"

import useSWR from "swr"
import { Folder, ExternalLink, Circle, Star, GitFork, Loader2, AlertCircle } from "lucide-react"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  homepage: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  updated_at: string
  archived: boolean
  fork: boolean
}

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
})

function getLanguageColor(language: string | null): string {
  const colors: Record<string, string> = {
    TypeScript: "bg-blue-400",
    JavaScript: "bg-yellow-400",
    Python: "bg-green-400",
    Rust: "bg-orange-400",
    Go: "bg-cyan-400",
    Java: "bg-red-400",
    CSS: "bg-purple-400",
    HTML: "bg-orange-500",
  }
  return colors[language || ""] || "bg-gray-400"
}

function ProjectCard({ repo }: { repo: GitHubRepo }) {
  return (
    <div className="group flex flex-col p-4 bg-card rounded-lg border border-border hover:border-accent/50 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
            <Folder className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors truncate">
              {repo.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {repo.archived && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                  Archived
                </span>
              )}
              {repo.fork && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                  <GitFork className="w-3 h-3" /> Fork
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={`View ${repo.name} on GitHub`}
          >
            <GitHubIcon className="w-4 h-4 text-muted-foreground hover:text-accent" />
          </a>
          {repo.homepage && (
            <a
              href={repo.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={`Visit ${repo.name}`}
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-accent" />
            </a>
          )}
        </div>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 min-h-[2.5rem]">
        {repo.description || "No description available"}
      </p>
      
      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <Circle className={`w-2 h-2 ${getLanguageColor(repo.language)}`} style={{ fill: "currentColor" }} />
              {repo.language}
            </span>
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
    </div>
  )
}

export function ProjectsGrid() {
  const { data: repos, error, isLoading } = useSWR<GitHubRepo[]>(
    "/api/github/repos",
    fetcher,
    { refreshInterval: 300000 } // Refresh every 5 minutes
  )

  const displayRepos = repos?.filter((repo) => !repo.fork) || []

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
            <Folder className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Projects</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Loading..." : `${displayRepos.length} repositories`}
            </p>
          </div>
        </div>
        <a
          href="https://github.com/Snr-Dave?tab=repositories"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
        >
          View all
        </a>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        )}
        
        {error && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load repositories</p>
          </div>
        )}
        
        {!isLoading && !error && displayRepos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Folder className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No repositories found</p>
          </div>
        )}
        
        {!isLoading && !error && displayRepos.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {displayRepos.map((repo) => (
              <ProjectCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
