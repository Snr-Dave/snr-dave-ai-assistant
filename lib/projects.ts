export interface Project {
  id: string
  name: string
  description: string
  status: "active" | "completed" | "archived"
  technologies: string[]
  url?: string
  github?: string
}

// Simple array structure prepared for future DB integration
export const projects: Project[] = [
  {
    id: "1",
    name: "Snr-Dave AI Assistant",
    description: "Personal AI-powered dashboard with chat interface and GitHub integration",
    status: "active",
    technologies: ["Next.js", "AI SDK", "Tailwind CSS"],
    github: "https://github.com/Snr-Dave/snr-dave-ai-assistant",
  },
  {
    id: "2",
    name: "Portfolio Website",
    description: "Modern developer portfolio showcasing projects and skills",
    status: "completed",
    technologies: ["React", "TypeScript", "Framer Motion"],
    url: "https://snr-dave.dev",
  },
  {
    id: "3",
    name: "Code Analyzer",
    description: "AI-powered code review and analysis tool",
    status: "active",
    technologies: ["Python", "OpenAI", "FastAPI"],
  },
  {
    id: "4",
    name: "Task Automation Suite",
    description: "Collection of scripts for automating development workflows",
    status: "active",
    technologies: ["Node.js", "Shell", "GitHub Actions"],
  },
]

export function getActiveProjects(): Project[] {
  return projects.filter((p) => p.status === "active")
}

export function getProjectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id)
}
