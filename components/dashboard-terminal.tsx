"use client"

import dynamic from "next/dynamic"
import { useRef, useState, useCallback } from "react"
import {
  Terminal as TerminalIcon,
  Trash2, Copy, Check,
  Maximize2, Minimize2,
  ALargeSmall,
} from "lucide-react"

export interface TerminalHandle {
  clear:       () => void
  copySelection: () => Promise<void>
  setFontSize: (n: number) => void
}

const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20] as const
const DEFAULT_FONT_SIZE = 13

const XTermCore = dynamic(
  () => import("./xterm-core").then((m) => ({ default: m.XTermCore })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
        <span className="text-xs font-mono text-[#00d9ff]/50 animate-pulse">
          Initializing console…
        </span>
      </div>
    ),
  }
)

interface DashboardTerminalProps {
  isFullHeight?:      boolean
  onToggleFullHeight?: () => void
}

export function DashboardTerminal({
  isFullHeight      = false,
  onToggleFullHeight,
}: DashboardTerminalProps) {
  const handleRef  = useRef<TerminalHandle>(null)
  const [copied,   setCopied]   = useState(false)
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)

  // ── Font size helpers ──────────────────────────────────────────────────────
  const currentIdx = FONT_SIZES.indexOf(fontSize as typeof FONT_SIZES[number])

  const decreaseFont = useCallback(() => {
    const next = FONT_SIZES[Math.max(0, currentIdx - 1)]
    setFontSize(next)
    handleRef.current?.setFontSize(next)
  }, [currentIdx])

  const increaseFont = useCallback(() => {
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, currentIdx + 1)]
    setFontSize(next)
    handleRef.current?.setFontSize(next)
  }, [currentIdx])

  // ── Copy / Clear ───────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    handleRef.current?.clear()
  }, [])

  const handleCopy = useCallback(async () => {
    await handleRef.current?.copySelection()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-lg border border-border overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-card/60 flex-shrink-0">

        {/* Icon + title */}
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-accent/10 flex-shrink-0">
          <TerminalIcon className="w-3 h-3 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground">System Console</span>
        </div>

        {/* ── Controls group ────────────────────────────────────────────── */}
        <div className="flex items-center gap-0.5">

          {/* Font size */}
          <div className="flex items-center gap-0.5 mr-1">
            <ALargeSmall className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <button
              type="button"
              onClick={decreaseFont}
              disabled={currentIdx === 0}
              title="Decrease font size"
              className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-muted-foreground
                         hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              −
            </button>
            <span className="w-5 text-center text-[10px] font-mono text-muted-foreground tabular-nums select-none">
              {fontSize}
            </span>
            <button
              type="button"
              onClick={increaseFont}
              disabled={currentIdx === FONT_SIZES.length - 1}
              title="Increase font size"
              className="flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-muted-foreground
                         hover:text-accent hover:bg-accent/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              +
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-4 bg-border mx-1" />

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy selection"
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md text-muted-foreground
                       hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400" />
              : <Copy  className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={handleClear}
            title="Clear terminal"
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md text-muted-foreground
                       hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {/* Full Height toggle */}
          {onToggleFullHeight && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                type="button"
                onClick={onToggleFullHeight}
                title={isFullHeight ? "Restore panel" : "Full-screen terminal"}
                className={`flex items-center justify-center w-7 h-7 rounded-md border transition-all ${
                  isFullHeight
                    ? "text-accent border-accent/40 bg-accent/10 hover:bg-accent/20"
                    : "text-muted-foreground border-transparent hover:text-accent hover:bg-accent/10 hover:border-accent/20"
                }`}
              >
                {isFullHeight
                  ? <Minimize2 className="w-3.5 h-3.5" />
                  : <Maximize2 className="w-3.5 h-3.5" />
                }
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── xterm canvas ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 p-2">
        <XTermCore ref={handleRef} />
      </div>
    </div>
  )
}
