import { ExternalLink } from 'lucide-react'
import { FlowCanvas } from './components/FlowCanvas/FlowCanvas'
import { useFlowStore } from './store/flowStore'

function Header() {
  const { fileName, nodes, resetFlow } = useFlowStore()
  const cellCount = nodes.filter((node) => node.type === 'cellNode').length

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-lpf-border bg-lpf-surface px-5">
      <button
        onClick={resetFlow}
        className="flex items-center gap-2.5 transition-opacity hover:opacity-70"
        title="重置画布"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-lpf-border bg-lpf-card">
          <span className="font-mono text-[10px] font-bold text-lpf-text">EX</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold tracking-tight text-lpf-text">exceling</span>
          <span className="rounded border border-lpf-border bg-lpf-card px-1.5 py-0.5 font-mono text-[9px] text-lpf-subtle">
            pivot / phase 0
          </span>
        </div>
      </button>

      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="max-w-[220px] truncate text-lpf-muted">{fileName ?? 'blank-canvas'}</span>
        <span className="text-lpf-subtle">·</span>
        <span className="text-lpf-subtle">{cellCount} cells</span>
      </div>

      <a
        href="https://github.com/Frankfromfuture/Exceling"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-lpf-subtle transition-colors hover:bg-lpf-card hover:text-lpf-muted"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        <span>GitHub</span>
      </a>
    </header>
  )
}

export default function App() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-lpf-bg">
      <Header />
      <main className="relative flex-1 overflow-hidden">
        <FlowCanvas />
      </main>
    </div>
  )
}
