import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { SumClusterFlowNode, SumClusterNodeData } from '../../types'
import { useFlowStore } from '../../store/flowStore'

function formatVal(v: number | string | null, isPercent: boolean, numDec: number, pctMode: boolean, pctDec: number): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (isPercent && pctMode) return (v * 100).toLocaleString('zh-CN', { minimumFractionDigits: pctDec, maximumFractionDigits: pctDec }) + '%'
  const dec = isPercent ? pctDec : numDec
  return v.toLocaleString('zh-CN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export const SumClusterNode = memo(function SumClusterNode({ id, data }: NodeProps<SumClusterFlowNode>) {
  const { memberIds, memberLabels, memberValues, memberIsPercent, total, count, min, max, mean, annotation } = data as SumClusterNodeData
  const [expanded, setExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const { setNodes } = useReactFlow()

  const { numberDecimals, percentMode, percentDecimals } = useFlowStore(s => s.displaySettings)
  const focusMainPath = useFlowStore(s => s.focusMainPath)
  const activeNodeIds = useFlowStore(s => s.activeNodeIds)
  const hasMainPath   = useFlowStore(s => s.hasMainPath)
  const mainPathNodeIds = useFlowStore(s => s.mainPathNodeIds)

  const isActive = activeNodeIds.has(id)
  const isOnMainPath = !hasMainPath || mainPathNodeIds.has(id)
  const isOffFocus = focusMainPath && !isOnMainPath
  const nodeOpacity: number = isOffFocus ? 0.32 : 1
  const nodeFilter  = isOffFocus ? 'grayscale(1) brightness(1.08)' : 'none'

  const onMouseEnter = useCallback(() => {
    setIsHovered(true)
    setNodes(nds => nds.map(n => n.id === id ? { ...n, zIndex: 9999 } : n))
  }, [id, setNodes])
  const onMouseLeave = useCallback(() => {
    setIsHovered(false)
    setNodes(nds => nds.map(n => n.id === id ? { ...n, zIndex: 0 } : n))
  }, [id, setNodes])

  const borderCls = isActive ? 'border-sky-500' : isOnMainPath && hasMainPath ? 'border-sky-400/90' : 'border-sky-300/70 hover:border-sky-400/80'
  const glowCls = isActive ? 'shadow-[0_0_24px_rgba(56,189,248,0.35)]' : isOnMainPath && hasMainPath ? 'shadow-[0_0_18px_rgba(56,189,248,0.25)]' : 'shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_0_16px_rgba(56,189,248,0.20)]'

  const isPct = memberIsPercent.length > 0 && memberIsPercent.every(p => p) // uniform percent

  return (
    <div
      style={{ opacity: nodeOpacity, filter: nodeFilter, transition: 'opacity 1.5s ease, filter 1.5s ease', pointerEvents: nodeOpacity === 0 ? 'none' : 'auto' }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    >
      <div className={['relative rounded-[18px] border overflow-hidden w-[240px] transition-all duration-300 cursor-default select-none backdrop-blur-sm bg-white/95', isHovered ? 'scale-[1.02]' : 'scale-100', borderCls, glowCls].join(' ')}>
        <Handle type="target" position={Position.Left} className="!border-sky-300 !bg-sky-50 !w-2.5 !h-2.5" />
        <Handle type="source" position={Position.Right} className="!border-sky-300 !bg-sky-50 !w-2.5 !h-2.5" />

        {/* Top gradient bar */}
        <div className="h-[3px] w-full bg-gradient-to-r from-sky-400 to-blue-400" />

        <div className="px-3.5 pt-2.5 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="shrink-0 w-5 h-5 rounded-md bg-sky-100 border border-sky-200 flex items-center justify-center">
                <span className="text-[12px] font-bold text-sky-600">Σ</span>
              </div>
              <span className="text-[12px] font-semibold text-sky-800 truncate leading-none">SUM 汇总池</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="text-[9px] font-mono text-sky-600/70 leading-none">{count}项</div>
              <button onClick={() => setExpanded(v => !v)} className="w-4 h-4 rounded flex items-center justify-center text-sky-400 hover:text-sky-700 hover:bg-sky-50 transition-colors">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-sky-700/70 mt-1.5 leading-[1.5] font-medium">{annotation}</p>
        </div>

        <div className="h-px bg-sky-100 mx-3.5" />

        <div className="px-3.5 py-2 grid grid-cols-2 gap-y-1 gap-x-2">
          <div className="flex items-center justify-between col-span-2">
            <span className="text-[10px] text-neutral-400">合计</span>
            <span className="text-[12px] font-mono font-bold text-sky-600">{formatVal(total, isPct, numberDecimals, percentMode, percentDecimals)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-neutral-400">均值</span>
            <span className="text-[9px] font-mono text-neutral-600">{formatVal(mean, isPct, numberDecimals, percentMode, percentDecimals)}</span>
          </div>
          <div className="flex items-center justify-between"></div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-neutral-400">最大</span>
            <span className="text-[9px] font-mono text-emerald-600">{formatVal(max, isPct, numberDecimals, percentMode, percentDecimals)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-neutral-400">最小</span>
            <span className="text-[9px] font-mono text-amber-600">{formatVal(min, isPct, numberDecimals, percentMode, percentDecimals)}</span>
          </div>
        </div>

        {expanded && (
          <>
            <div className="h-px bg-sky-100/50 mx-3.5" />
            <div className="px-3 py-2 flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar">
              {memberIds.map((mid, i) => (
                <div key={mid} className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded-lg hover:bg-sky-50/60 transition-colors">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                    <span className="text-[10px] text-neutral-600 truncate">{memberLabels[i] || mid}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {formatVal(memberValues[i], memberIsPercent[i] || false, numberDecimals, percentMode, percentDecimals)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {(isActive || (isOnMainPath && hasMainPath)) && (
          <div className="absolute inset-0 rounded-[18px] ring-1 ring-sky-300/50 pointer-events-none" />
        )}
      </div>
    </div>
  )
})
