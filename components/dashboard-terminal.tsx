"use client"

import dynamic from "next/dynamic"
import { useRef, useState, useCallback } from "react"
import { Terminal as TerminalIcon, Trash2, Copy, Check } from "lucide-react"

export interface TerminalHandle {
  clear: () => void
  copySelection: () => Promise<void>
}

const XTermCore = dynamic(
  () => import("./xterm-core").then((m) => ({ default: m.XTermCore })),
  { ssr: false, loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <span className="text-xs font-mono text-[#00d9ff]/50 animate-pulse">
        Initializing console…
      </span>
    </div>
  )}
)

export function DashboardTerminal() {
  const handleRef = useRef<TerminalHandle>(null)
  const [copied, setCopied]     = useState(false)

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
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/60 flex-shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent/10">
          <TerminalIcon className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">System Console</h3>
          <p className="text-xs text-muted-foreground font-mono">Echo mode — interactive input ready</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy selection"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-muted-foreground hover:text-accent hover:bg-accent/10 border border-transparent hover:border-accent/20 transition-all"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-green-400" />
              : <Copy  className="w-3.5 h-3.5" />
            }
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            type="button"
            onClick={handleClear}
            title="Clear terminal"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* xterm container */}
      <div className="flex-1 min-h-0 p-2">
        <XTermCore ref={handleRef} />
      </div>
    </div>
  )
}
