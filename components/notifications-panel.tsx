"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react"
import {
  type Notification,
  type NotificationLevel,
  clearAll,
  dismiss,
  markAllRead,
  useNotifications,
} from "@/lib/notifications"

interface NotificationsPanelProps {
  open:    boolean
  onClose: () => void
}

const LEVEL_STYLES: Record<NotificationLevel, { icon: React.ReactNode; tone: string }> = {
  info:    { icon: <Info        className="w-4 h-4" />, tone: "text-blue-400"   },
  success: { icon: <CheckCircle2 className="w-4 h-4" />, tone: "text-green-400"  },
  warn:    { icon: <AlertTriangle className="w-4 h-4" />, tone: "text-amber-400" },
  error:   { icon: <AlertCircle className="w-4 h-4" />, tone: "text-red-400"     },
}

function formatRelative(ts: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  if (seconds < 5)   return "just now"
  if (seconds < 60)  return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)    return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotificationRow({ item, now }: { item: Notification; now: number }) {
  const style = LEVEL_STYLES[item.level]
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 ${
        item.read ? "opacity-60" : ""
      }`}
    >
      <div className={`mt-0.5 ${style.tone}`}>{style.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            {item.source}
          </span>
        </div>
        {item.message && (
          <p className="text-xs text-muted-foreground mt-0.5 break-words font-mono">
            {item.message}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">{formatRelative(item.ts, now)}</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const notifications = useNotifications()
  const ref = useRef<HTMLDivElement>(null)
  // Re-render once a minute so relative timestamps stay fresh.
  const now = useNowTick(open)

  // Mark everything as read once the panel becomes visible.
  useEffect(() => {
    if (open) markAllRead()
  }, [open, notifications.length])

  // Click-outside to close.
  useEffect(() => {
    if (!open) return
    function onPointerDown(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose()
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-12 z-50 w-80 max-h-[28rem] flex flex-col bg-card border border-border rounded-lg shadow-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <div>
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <p className="text-[11px] text-muted-foreground">
            {notifications.length === 0
              ? "No activity yet"
              : `${notifications.length} item${notifications.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={clearAll}
          disabled={notifications.length === 0}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground rounded transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              You&apos;re all caught up. Terminal exit codes, AI status changes,
              and system alerts will appear here.
            </p>
          </div>
        ) : (
          notifications.map((n) => <NotificationRow key={n.id} item={n} now={now} />)
        )}
      </div>
    </div>
  )
}

function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [active])
  return now
}
