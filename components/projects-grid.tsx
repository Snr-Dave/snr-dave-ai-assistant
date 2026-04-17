"use client"

import { projects, type Project } from "@/lib/projects"
import { Folder, ExternalLink, Github, Circle } from "lucide-react"

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
              <Github className="w-4 h-4 text-muted-foreground hover:text-accent" />
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
