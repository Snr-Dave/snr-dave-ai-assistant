import { DashboardHeader } from "@/components/dashboard-header"
import { ChatWindow } from "@/components/chat-window"
import { GitHubFeed } from "@/components/github-feed"
import { ProjectsGrid } from "@/components/projects-grid"
import { SystemStatus } from "@/components/system-status"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="flex-1 p-4 lg:p-6">
        {/* System Status Bar */}
        <div className="mb-6">
          <SystemStatus />
        </div>

        {/* Main Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-12 lg:grid-rows-[minmax(500px,1fr)]">
          {/* Chat Window - Takes up more space on larger screens */}
          <div className="lg:col-span-5 xl:col-span-4 h-[500px] lg:h-auto">
            <ChatWindow />
          </div>

          {/* GitHub Feed */}
          <div className="lg:col-span-3 xl:col-span-3 h-[400px] lg:h-auto">
            <GitHubFeed />
          </div>

          {/* Projects Grid */}
          <div className="lg:col-span-4 xl:col-span-5 h-[500px] lg:h-auto">
            <ProjectsGrid />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-border bg-card/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="font-mono">
            <span className="text-accent">&gt;</span> Snr-Dave AI Assistant // Built with Next.js 15 + AI SDK
          </p>
          <p className="font-mono">
            System ready. <span className="text-green-400">All services operational.</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
