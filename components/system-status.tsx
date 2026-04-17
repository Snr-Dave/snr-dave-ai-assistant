"use client"

import { useEffect, useState } from "react"
import { Activity, Cpu, HardDrive, Wifi, RefreshCw } from "lucide-react"

type ConnectionStatus = "online" | "checking" | "offline"

interface StatusState {
  api: ConnectionStatus
  ai: ConnectionStatus
  github: ConnectionStatus
}

interface StatusItemProps {
  icon: React.ReactNode
  label: string
  value: string
  status: ConnectionStatus
}

function StatusItem({ icon, label, value, status }: StatusItemProps) {
  const statusColors = {
    online: "bg-green-400",
    checking: "bg-yellow-400 animate-pulse",
    offline: "bg-red-400",
  }

  const statusText = {
    online: "Connected",
    checking: "Checking...",
    offline: "Offline",
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">
          {status === "checking" ? statusText[status] : value}
        </p>
      </div>
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
    </div>
  )
}

export function SystemStatus() {
  const [status, setStatus] = useState<StatusState>({
    api: "checking",
    ai: "checking",
    github: "checking",
  })
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const checkStatus = async () => {
    setIsRefreshing(true)
    setStatus({ api: "checking", ai: "checking", github: "checking" })

    // Check API Gateway (our chat endpoint)
    try {
      const apiResponse = await fetch("/api/chat", { method: "GET" })
      const apiData = await apiResponse.json()
      setStatus((prev) => ({
        ...prev,
        api: apiResponse.ok ? "online" : "offline",
        ai: apiData.model ? "online" : "offline",
      }))
      console.log("[v0] API status check:", apiData)
    } catch (error) {
      console.error("[v0] API status check failed:", error)
      setStatus((prev) => ({ ...prev, api: "offline", ai: "offline" }))
    }

    // Check GitHub API
    try {
      const githubResponse = await fetch("https://api.github.com/users/Snr-Dave")
      setStatus((prev) => ({
        ...prev,
        github: githubResponse.ok ? "online" : "offline",
      }))
      console.log("[v0] GitHub status check:", githubResponse.ok)
    } catch (error) {
      console.error("[v0] GitHub status check failed:", error)
      setStatus((prev) => ({ ...prev, github: "offline" }))
    }

    setLastChecked(new Date())
    setIsRefreshing(false)
  }

  useEffect(() => {
    checkStatus()
    // Re-check every 60 seconds
    const interval = setInterval(checkStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const allOnline = Object.values(status).every((s) => s === "online")
  const hasOffline = Object.values(status).some((s) => s === "offline")

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
          <Activity className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">System Status</h2>
          <p className="text-xs text-muted-foreground">
            {allOnline ? "All systems operational" : hasOffline ? "Some systems offline" : "Checking..."}
          </p>
        </div>
        <button
          onClick={checkStatus}
          disabled={isRefreshing}
          className="ml-auto p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Refresh status"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Status Grid */}
      <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusItem
          icon={<Wifi className="w-4 h-4" />}
          label="API Gateway"
          value="Connected"
          status={status.api}
        />
        <StatusItem
          icon={<Cpu className="w-4 h-4" />}
          label="AI Model"
          value="Gemini 2.5 Flash"
          status={status.ai}
        />
        <StatusItem
          icon={<HardDrive className="w-4 h-4" />}
          label="GitHub API"
          value="Connected"
          status={status.github}
        />
        <StatusItem
          icon={<Activity className="w-4 h-4" />}
          label="Last Check"
          value={lastChecked ? lastChecked.toLocaleTimeString() : "Never"}
          status={allOnline ? "online" : hasOffline ? "offline" : "checking"}
        />
      </div>
    </div>
  )
}
