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

// GitHub API endpoint for fetching repositories
export const GITHUB_REPOS_URL = "https://api.github.com/users/Snr-Dave/repos?sort=updated&per_page=12"
