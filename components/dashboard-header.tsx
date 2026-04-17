"use client"

import { Terminal, Github, Settings, Bell } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent">
          <Terminal className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Snr-Dave <span className="text-accent">Command Center</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">v1.0.0 // AI-Powered Dashboard</p>
        </div>
      </div>

      <nav className="flex items-center gap-2">
        <a
          href="https://github.com/Snr-Dave"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="GitHub Profile"
        >
          <Github className="w-5 h-5" />
        </a>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full" />
        </button>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </nav>
    </header>
  )
}
