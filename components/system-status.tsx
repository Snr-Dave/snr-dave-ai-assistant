"use client"

import { Activity, Cpu, HardDrive, Wifi } from "lucide-react"

interface StatusItemProps {
  icon: React.ReactNode
  label: string
  value: string
  status: "online" | "warning" | "offline"
}

function StatusItem({ icon, label, value, status }: StatusItemProps) {
  const statusColors = {
    online: "text-green-400",
    warning: "text-yellow-400",
    offline: "text-red-400",
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
      <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
    </div>
  )
}

export function SystemStatus() {
  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10">
          <Activity className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">System Status</h2>
          <p className="text-xs text-muted-foreground">All systems operational</p>
        </div>
      </div>

      {/* Status Grid */}
      <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusItem
          icon={<Wifi className="w-4 h-4" />}
          label="API Gateway"
          value="Connected"
          status="online"
        />
        <StatusItem
          icon={<Cpu className="w-4 h-4" />}
          label="AI Model"
          value="Gemini 2.5 Flash"
          status="online"
        />
        <StatusItem
          icon={<HardDrive className="w-4 h-4" />}
          label="Database"
          value="Ready"
          status="online"
        />
        <StatusItem
          icon={<Activity className="w-4 h-4" />}
          label="Uptime"
          value="99.9%"
          status="online"
        />
      </div>
    </div>
  )
}
