"use client"

import { useState, useCallback } from "react"
import { Terminal, Settings, Bell } from "lucide-react"
import { SettingsPanel, type TabId } from "./settings-panel"
import { NotificationsPanel } from "./notifications-panel"
import { useUnreadCount } from "@/lib/notifications"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

export function DashboardHeader() {
  const [settingsOpen, setSettingsOpen]           = useState(false)
  const [activeTab, setActiveTab]                 = useState<TabId>("console")
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const unread = useUnreadCount()

  const openSettings        = useCallback(() => setSettingsOpen(true),  [])
  const closeSettings       = useCallback(() => setSettingsOpen(false), [])
  const toggleNotifications = useCallback(() => setNotificationsOpen((v) => !v), [])
  const closeNotifications  = useCallback(() => setNotificationsOpen(false), [])

  return (
    <>
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
            <GitHubIcon className="w-5 h-5" />
          </a>
          <div className="relative">
            <button
              type="button"
              onClick={toggleNotifications}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors relative ${
                notificationsOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold leading-none bg-accent text-accent-foreground rounded-full"
                  aria-label={`${unread} unread notifications`}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <NotificationsPanel open={notificationsOpen} onClose={closeNotifications} />
          </div>
          <button
            type="button"
            onClick={openSettings}
            aria-label="Settings"
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              settingsOpen
                ? "text-accent bg-accent/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </nav>
      </header>

      <SettingsPanel
        open={settingsOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={closeSettings}
      />
    </>
  )
}
