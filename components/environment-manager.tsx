"use client"

import { useEffect, useState, useCallback } from "react"
import { Eye, EyeOff, Save, Check, RefreshCw, KeyRound, AlertCircle, Loader2 } from "lucide-react"

interface EnvEntry {
  key:   string
  value: string
}

interface RowState {
  /** Value as currently shown in the input */
  draft:    string
  /** Last-known persisted value */
  saved:    string
  /** Reveal vs. mask */
  visible:  boolean
  /** Save in flight */
  saving:   boolean
  /** Time of last successful save (for the “Saved” badge) */
  savedAt:  number | null
  /** Per-row error message */
  error:    string | null
}

const initialRow = (value: string): RowState => ({
  draft:   value,
  saved:   value,
  visible: false,
  saving:  false,
  savedAt: null,
  error:   null,
})

export function EnvironmentManager() {
  const [rows,         setRows]         = useState<Record<string, RowState>>({})
  const [order,        setOrder]        = useState<string[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState<string | null>(null)

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

  // ── Row helpers ────────────────────────────────────────────────────────────
  const patch = (key: string, partial: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } }))

  const handleChange     = (key: string, draft: string) => patch(key, { draft, error: null })
  const toggleVisibility = (key: string) => patch(key, { visible: !rows[key]?.visible })

  const handleSave = async (key: string) => {
    const row = rows[key]
    if (!row || row.saving || row.draft === row.saved) return

    patch(key, { saving: true, error: null })
    try {
      const res = await fetch("/api/settings/env", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key, value: row.draft }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? `Save failed: ${res.status}`)

      patch(key, {
        saving:  false,
        saved:   row.draft,
        savedAt: Date.now(),
        error:   null,
      })

      // Auto-clear the “Saved” pill after 2.5 s
      setTimeout(() => {
        setRows((prev) => {
          const r = prev[key]
          if (!r || r.savedAt === null) return prev
          if (Date.now() - r.savedAt < 2500) return prev
          return { ...prev, [key]: { ...r, savedAt: null } }
        })
      }, 2600)
    } catch (err) {
      patch(key, {
        saving: false,
        error:  err instanceof Error ? err.message : "Save failed",
      })
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
          onClick={load}
          disabled={loading}
          title="Reload"
          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md text-muted-foreground
                     hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20
                     disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Reload</span>
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

        {!loading && !loadError && order.map((key) => {
          const row    = rows[key]
          if (!row) return null
          const dirty  = row.draft !== row.saved
          const showSavedPill = row.savedAt !== null && Date.now() - row.savedAt < 2600

          return (
            <div key={key} className="group">
              {/* Key + status pills */}
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

              {/* Input + actions */}
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
                    {row.visible
                      ? <EyeOff className="w-3.5 h-3.5" />
                      : <Eye    className="w-3.5 h-3.5" />
                    }
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
                  {row.saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Save    className="w-3.5 h-3.5" />
                  }
                  <span className="hidden sm:inline">Save</span>
                </button>
              </div>

              {/* Per-row error */}
              {row.error && (
                <p className="mt-1 text-[10px] text-red-300/90 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {row.error}
                </p>
              )}
            </div>
          )
        })}

        {!loading && !loadError && order.length === 0 && (
          <p className="text-center py-8 text-xs text-muted-foreground">No variables found.</p>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border bg-card/60 flex-shrink-0">
        <p className="text-[10px] text-muted-foreground">
          Tip: <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌘/Ctrl + Enter</kbd> saves the focused field.
        </p>
      </div>
    </div>
  )
}
