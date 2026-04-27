/**
 * Lightweight notification store.
 *
 * Module-scoped pub/sub bridged into React via `useSyncExternalStore`. Used to
 * surface real-time system alerts, terminal exit codes, AI status updates,
 * and any other dashboard-wide events to the bell-icon dropdown in the
 * header.
 *
 * Why not Zustand / Context? Zero new deps and no Provider plumbing — every
 * component can `notify(...)` from anywhere (client OR via the broadcast bus
 * surfaced through the terminal) and any UI can `useNotifications()` to read.
 */

"use client"

import { useSyncExternalStore } from "react"

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationLevel = "info" | "success" | "warn" | "error"

export type NotificationSource =
  | "terminal"
  | "ai"
  | "system"
  | "github"
  | "settings"

export interface Notification {
  id:        string
  ts:        number
  level:     NotificationLevel
  source:    NotificationSource
  title:     string
  message?:  string
  read:      boolean
  /** Optional grouping key — newer notifications with the same key replace older. */
  dedupeKey?: string
}

export interface NotifyInput {
  level:      NotificationLevel
  source:     NotificationSource
  title:      string
  message?:   string
  dedupeKey?: string
}

// ── Store ────────────────────────────────────────────────────────────────────

const MAX_NOTIFICATIONS = 50

let notifications: Notification[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

function getSnapshot(): Notification[] {
  return notifications
}

// SSR-safe snapshot — server has no notifications. The reference is stable
// (frozen empty array) so React doesn't see a "new" snapshot every render and
// won't bail into an infinite loop during hydration.
const EMPTY_SNAPSHOT: readonly Notification[] = Object.freeze([])
function getServerSnapshot(): Notification[] {
  return EMPTY_SNAPSHOT as Notification[]
}

// ── Public API ───────────────────────────────────────────────────────────────

let counter = 0
function nextId(): string {
  counter += 1
  return `n${Date.now().toString(36)}${counter.toString(36)}`
}

/** Push a new notification onto the stream. Returns the created notification. */
export function notify(input: NotifyInput): Notification {
  const item: Notification = {
    id:        nextId(),
    ts:        Date.now(),
    level:     input.level,
    source:    input.source,
    title:     input.title,
    message:   input.message,
    read:      false,
    dedupeKey: input.dedupeKey,
  }

  // Dedupe: drop any older notifications sharing the same dedupeKey so a
  // flapping endpoint doesn't spam the inbox.
  let next = notifications
  if (input.dedupeKey) {
    next = next.filter((n) => n.dedupeKey !== input.dedupeKey)
  }
  next = [item, ...next]
  if (next.length > MAX_NOTIFICATIONS) next = next.slice(0, MAX_NOTIFICATIONS)

  notifications = next
  emit()
  return item
}

/** Mark every notification as read. */
export function markAllRead(): void {
  if (notifications.every((n) => n.read)) return
  notifications = notifications.map((n) => (n.read ? n : { ...n, read: true }))
  emit()
}

/** Mark a single notification as read. */
export function markRead(id: string): void {
  const idx = notifications.findIndex((n) => n.id === id)
  if (idx === -1 || notifications[idx].read) return
  const next = notifications.slice()
  next[idx] = { ...next[idx], read: true }
  notifications = next
  emit()
}

/** Remove all notifications. */
export function clearAll(): void {
  if (notifications.length === 0) return
  notifications = []
  emit()
}

/** Remove a single notification. */
export function dismiss(id: string): void {
  const next = notifications.filter((n) => n.id !== id)
  if (next.length === notifications.length) return
  notifications = next
  emit()
}

// ── React hooks ──────────────────────────────────────────────────────────────

/** Subscribe a component to the notification stream. Re-renders on change. */
export function useNotifications(): Notification[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Returns just the unread count (cheap selector). */
export function useUnreadCount(): number {
  const items = useNotifications()
  let count = 0
  for (const n of items) if (!n.read) count += 1
  return count
}
