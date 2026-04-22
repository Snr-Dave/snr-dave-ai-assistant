"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Eye, EyeOff, Save, Check, RefreshCw, KeyRound,
  AlertCircle, Loader2, Plus, X,
} from "lucide-react"

interface EnvEntry { key: string; value: string }

interface RowState {
  draft:    string
  saved:    string
  visible:  boolean
  saving:   boolean
  savedAt:  number | null
  error:    string | null
}

interface DraftEntry {
  /** Stable client-side id so React keys remain stable while user types. */
  id:       string
  key:      string
  value:    string
  visible:  boolean
  saving:   boolean
  error:    string | null
}

const KEY_RE = /^[A-Z_][A-Z0-9_]*$/

const initialRow = (value: string): RowState => ({
  draft:   value,
  saved:   value,
  visible: false,
  saving:  false,
  savedAt: null,
  error:   null,
})

const newDraft = (): DraftEntry => ({
  id:      `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  key:     "",
  value:   "",
  visible: true,   // Show the value while user is composing it
  saving:  false,
  error:   null,
})

export function EnvironmentManager() {
  const [rows,      setRows]      = useState<Record<string, RowState>>({})
  const [order,     setOrder]     = useState<string[]>([])
  const [drafts,    setDrafts]    = useState<DraftEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ── Load entries ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/settings/env", { cache: "no-store" })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const { entries } = (await res.json()) as { entries: EnvEntry[] }

      const map: Record<string, RowState> = {}
      for (const { key, value } of entries) map[key] = initialRow(value)
      setRows(map)
      setOrder(entries.map((e) => e.key))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load environment")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Existing-row helpers ───────────────────────────────────────────────────
  const patchRow = (key: string, partial: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } }))

  const handleChange     = (key: string, draft: string) => patchRow(key, { draft, error: null })
  const toggleVisibility = (key: string) => patchRow(key, { visible: !rows[key]?.visible })

  const handleSave = async (key: string) => {
    const row = rows[key]
    if (!row || row.saving || row.draft === row.saved) return
    patchRow(key, { saving: true, error: null })
    try {
      const res = await fetch("/api/settings/env", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key, value: row.draft }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Save failed: ${res.status}`)

      patchRow(key, { saving: false, saved: row.draft, savedAt: Date.now(), error: null })

      setTimeout(() => {
        setRows((prev) => {
          const r = prev[key]
          if (!r || r.savedAt === null) return prev
          if (Date.now() - r.savedAt < 2500) return prev
          return { ...prev, [key]: { ...r, savedAt: null } }
        })
      }, 2600)
    } catch (err) {
      patchRow(key, { saving: false, error: err instanceof Error ? err.message : "Save failed" })
    }
  }

  // ── Draft (new-entry) helpers ──────────────────────────────────────────────
  const addDraft = () => setDrafts((prev) => [...prev, newDraft()])

  const patchDraft = (id: string, partial: Partial<DraftEntry>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...partial } : d)))

  const removeDraft = (id: string) =>
    setDrafts((prev) => prev.filter((d) => d.id !== id))

  const saveDraft = async (id: string) => {
    const draft = drafts.find((d) => d.id === id)
    if (!draft || draft.saving) return

    const trimmedKey = draft.key.trim()
    if (!KEY_RE.test(trimmedKey)) {
      patchDraft(id, { error: "Key must match ^[A-Z_][A-Z0-9_]* (uppercase, digits, underscores)" })
      return
    }
    if (rows[trimmedKey]) {
      patchDraft(id, { error: `${trimmedKey} already exists above — edit it directly.` })
      return
    }
    if (drafts.some((d) => d.id !== id && d.key.trim() === trimmedKey)) {
      patchDraft(id, { error: "Another draft uses this key." })
      return
    }

    patchDraft(id, { saving: true, error: null })
    try {
      const res = await fetch("/api/settings/env", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: trimmedKey, value: draft.value }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Save failed: ${res.status}`)

      // Promote the draft into a regular row with a "Saved" pill
      setRows((prev) => ({
        ...prev,
        [trimmedKey]: { ...initialRow(draft.value), savedAt: Date.now() },
      }))
      setOrder((prev) => (prev.includes(trimmedKey) ? prev : [...prev, trimmedKey]))
      removeDraft(id)

      setTimeout(() => {
        setRows((prev) => {
          const r = prev[trimmedKey]
          if (!r || r.savedAt === null) return prev
          return { ...prev, [trimmedKey]: { ...r, savedAt: null } }
        })
      }, 2600)
    } catch (err) {
      patchDraft(id, { saving: false, error: err instanceof Error ? err.message : "Save failed" })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-lg border border-border overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/60 flex-shrink-0">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-accent/10 flex-shrink-0">
          <KeyRound className="w-3 h-3 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground">Environment Variables</span>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Persisted to <code className="text-accent/80">.env</code> · restart may be required
          </p>
        </div>

        <button
          type="button"
          onClick={addDraft}
          title="Add a new secret"
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md
                     text-accent bg-accent/10 border border-accent/30
                     hover:bg-accent/20 hover:border-accent/60 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Secret</span>
        </button>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Reload"
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground
                     hover:text-accent hover:bg-accent/10 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

        {loading && (
          <div className="flex items-center justify-center py-12 text-xs font-mono text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin text-accent" />
            Loading environment…
          </div>
        )}

        {loadError && !loading && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-red-500/30 bg-red-500/5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-300">Failed to load</p>
              <p className="text-[11px] text-red-300/70 break-all">{loadError}</p>
            </div>
          </div>
        )}

        {/* Existing rows */}
        {!loading && !loadError && order.map((key) => {
          const row    = rows[key]
          if (!row) return null
          const dirty  = row.draft !== row.saved
          const showSavedPill = row.savedAt !== null && Date.now() - row.savedAt < 2600

          return (
            <div key={key} className="group">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label
                  htmlFor={`env-${key}`}
                  className="text-[11px] font-mono font-semibold text-foreground tracking-wide truncate"
                >
                  {key}
                </label>
                <div className="flex items-center gap-1.5">
                  {showSavedPill && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                                     text-green-300 bg-green-500/10 border border-green-500/30">
                      <Check className="w-2.5 h-2.5" />
                      Saved
                    </span>
                  )}
                  {dirty && !showSavedPill && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                                     text-accent bg-accent/10 border border-accent/30">
                      Modified
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-stretch gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    id={`env-${key}`}
                    type={row.visible ? "text" : "password"}
                    value={row.draft}
                    onChange={(e) => handleChange(key, e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave(key)
                    }}
                    placeholder="(empty)"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-[#0f0f0f] text-foreground
                               rounded-md border border-border placeholder:text-muted-foreground/40
                               focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40
                               transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => toggleVisibility(key)}
                    title={row.visible ? "Hide value" : "Show value"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center
                               w-7 h-7 rounded text-muted-foreground hover:text-accent hover:bg-accent/10
                               transition-colors"
                  >
                    {row.visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSave(key)}
                  disabled={!dirty || row.saving}
                  title="Save (⌘/Ctrl + Enter)"
                  className="flex items-center gap-1 px-3 text-xs font-medium rounded-md
                             bg-accent/10 text-accent border border-accent/30
                             hover:bg-accent/20 hover:border-accent/60
                             disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-accent/10
                             transition-all"
                >
                  {row.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Save</span>
                </button>
              </div>

              {row.error && (
                <p className="mt-1 text-[10px] text-red-300/90 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {row.error}
                </p>
              )}
            </div>
          )
        })}

        {/* New-entry drafts */}
        {drafts.map((d) => {
          const keyValid = KEY_RE.test(d.key.trim())
          const canSave  = keyValid && !d.saving

          return (
            <div
              key={d.id}
              className="p-3 rounded-md border border-accent/30 bg-accent/5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                  <Plus className="w-3 h-3" />
                  New Secret
                </span>
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  title="Discard draft"
                  className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground
                             hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Key input */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Key
                </label>
                <input
                  type="text"
                  value={d.key}
                  onChange={(e) => patchDraft(d.id, { key: e.target.value.toUpperCase(), error: null })}
                  placeholder="MY_API_KEY"
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  className={`w-full px-3 py-2 text-xs font-mono bg-[#0f0f0f] text-foreground
                              rounded-md border placeholder:text-muted-foreground/40
                              focus:outline-none focus:ring-1 transition-colors
                              ${d.key && !keyValid
                                ? "border-red-500/50 focus:border-red-400 focus:ring-red-400/40"
                                : "border-border focus:border-accent focus:ring-accent/40"}`}
                />
                {d.key && !keyValid && (
                  <p className="mt-1 text-[10px] text-red-300/90">
                    Invalid format — use UPPERCASE letters, digits, and underscores (e.g. <code>MY_API_KEY</code>).
                  </p>
                )}
              </div>

              {/* Value input + actions */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Value
                </label>
                <div className="flex items-stretch gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type={d.visible ? "text" : "password"}
                      value={d.value}
                      onChange={(e) => patchDraft(d.id, { value: e.target.value, error: null })}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSave) saveDraft(d.id)
                      }}
                      placeholder="(empty)"
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-[#0f0f0f] text-foreground
                                 rounded-md border border-border placeholder:text-muted-foreground/40
                                 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40
                                 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => patchDraft(d.id, { visible: !d.visible })}
                      title={d.visible ? "Hide value" : "Show value"}
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center
                                 w-7 h-7 rounded text-muted-foreground hover:text-accent hover:bg-accent/10
                                 transition-colors"
                    >
                      {d.visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => saveDraft(d.id)}
                    disabled={!canSave}
                    title="Save secret"
                    className="flex items-center gap-1 px-3 text-xs font-medium rounded-md
                               bg-accent/15 text-accent border border-accent/40
                               hover:bg-accent/25 hover:border-accent/70
                               disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-accent/15
                               transition-all"
                  >
                    {d.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">Save</span>
                  </button>
                </div>
              </div>

              {d.error && (
                <p className="text-[10px] text-red-300/90 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {d.error}
                </p>
              )}
            </div>
          )
        })}

        {!loading && !loadError && order.length === 0 && drafts.length === 0 && (
          <p className="text-center py-8 text-xs text-muted-foreground">
            No variables yet. Click <span className="text-accent">+ Add Secret</span> to create one.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-card/60 flex-shrink-0">
        <p className="text-[10px] text-muted-foreground">
          Tip: <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌘/Ctrl + Enter</kbd> saves the focused field.
        </p>
      </div>
    </div>
  )
}
