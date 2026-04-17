// Type definitions for GitHub repository data
// Data is now fetched dynamically from GitHub API

export interface GitHubRepo {
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

// Legacy type kept for potential future DB integration
export interface Project {
  id: string
  name: string
  description: string
  status: "active" | "completed" | "archived"
  technologies: string[]
  url?: string
  github?: string
}

// Internal API route — token is applied server-side
export const GITHUB_REPOS_URL = "/api/github/repos"
