"use client"

import { projects, type Project } from "@/lib/projects"
import { Folder, ExternalLink, Circle } from "lucide-react"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const styles = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    completed: "bg-accent/10 text-accent border-accent/20",
    archived: "bg-muted text-muted-foreground border-border",
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
      <Circle className="w-1.5 h-1.5 fill-current" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="group flex flex-col p-4 bg-card rounded-lg border border-border hover:border-accent/50 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
            <Folder className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
              {project.name}
            </h3>
            <StatusBadge status={project.status} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={`View ${project.name} on GitHub`}
            >
              <GitHubIcon className="w-4 h-4 text-muted-foreground hover:text-accent" />
            </a>
          )}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={`Visit ${project.name}`}
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-accent" />
            </a>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {project.description}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5">
        {project.technologies.map((tech) => (
          <span
            key={tech}
            className="px-2 py-0.5 text-xs font-mono bg-muted text-muted-foreground rounded"
          >
            {tech}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ProjectsGrid() {
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
            <p className="text-xs text-muted-foreground">{projects.length} total</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  )
}
