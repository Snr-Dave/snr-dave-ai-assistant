"use client"

import { useEffect, useRef } from "react"
import { X, Terminal, Settings } from "lucide-react"
import { DashboardTerminal } from "./dashboard-terminal"

const TABS = [
  { id: "console", label: "System Console", icon: Terminal },
] as const

type TabId = (typeof TABS)[number]["id"]

interface SettingsPanelProps {
  open:     boolean
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onClose:  () => void
}

export function SettingsPanel({ open, activeTab, onTabChange, onClose }: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    if (open) document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Trap focus when open
  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-over panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label="Settings panel"
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[560px] flex flex-col
          bg-card border-l border-border shadow-2xl outline-none
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Panel header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
            <Settings className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Settings</h2>
            <p className="text-xs text-muted-foreground">Command Center configuration</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-border flex-shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 transition-all ${
                activeTab === id
                  ? "border-accent text-accent bg-accent/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 p-4">
          {activeTab === "console" && (
            <div className="h-full">
              <DashboardTerminal />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
