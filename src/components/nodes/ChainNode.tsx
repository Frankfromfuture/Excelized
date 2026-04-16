import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { ChainFlowNode, ChainNodeData, Operator } from '../../types'
import { useFlowStore } from '../../store/flowStore'

const OPERATOR_SYMBOL: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }

function formatVal(
  v: number | string | null,
  isPercent: boolean,
  numDec: number,
  pctMode: boolean,
  pctDec: number,
): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (isPercent && pctMode) {
    return (v * 100).toLocaleString('zh-CN', {
      minimumFractionDigits: pctDec,
      maximumFractionDigits: pctDec,
    }) + '%'
  }
  const dec = isPercent ? pctDec : numDec
  return v.toLocaleString('zh-CN', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

export const ChainNode = memo(function ChainNode({ id, data }: NodeProps<ChainFlowNode>) {
  const { steps, annotation } = data as ChainNodeData
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

  const borderCls = isActive
    ? 'border-violet-500'
    : isOnMainPath && hasMainPath
      ? 'border-violet-400/90'
      : 'border-violet-300/70 hover:border-violet-400/80'

  const glowCls = isActive
    ? 'shadow-[0_0_24px_rgba(139,92,246,0.35)]'
    : isOnMainPath && hasMainPath
      ? 'shadow-[0_0_18px_rgba(139,92,246,0.25)]'
      : 'shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_0_16px_rgba(139,92,246,0.20)]'

  const count = steps.length

  return (
    <div
      style={{
        opacity: nodeOpacity, filter: nodeFilter,
        transition: 'opacity 1.5s ease, filter 1.5s ease',
        pointerEvents: nodeOpacity === 0 ? 'none' : 'auto',
      }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
    >
      <div
        className={[
          'relative rounded-[18px] border overflow-hidden',
          'w-[250px]',
          'transition-all duration-300 cursor-default select-none',
          isHovered ? 'scale-[1.02]' : 'scale-100',
          'backdrop-blur-sm bg-white/95',
          borderCls, glowCls,
        ].join(' ')}
      >
        <Handle type="target" position={Position.Left} className="!border-violet-300 !bg-violet-50 !w-2.5 !h-2.5" />
        <Handle type="source" position={Position.Right} className="!border-violet-300 !bg-violet-50 !w-2.5 !h-2.5" />

        {/* Top gradient bar */}
        <div className="h-[3px] w-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />

        <div className="px-3.5 pt-2.5 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="shrink-0 w-5 h-5 rounded-md bg-violet-100 border border-violet-200 flex items-center justify-center">
                <span className="text-[12px] font-bold text-violet-600">⛓</span>
              </div>
              <span className="text-[12px] font-semibold text-violet-800 truncate leading-none">
                直线计算链
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="text-[9px] font-mono text-violet-600/70 leading-none">
                {count - 1} 步运算
              </div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-4 h-4 rounded flex items-center justify-center text-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-violet-700/70 mt-1.5 leading-[1.5] font-medium">
            {annotation}
          </p>
        </div>

        <div className="h-px bg-violet-100 mx-3.5" />

        {!expanded && (
          <div className="px-3.5 py-2 flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 leading-none truncate max-w-[45%]">{steps[0].label}</span>
            <span className="text-[10px] text-violet-500/60 leading-none px-1">→ … →</span>
            <span className="text-[10px] text-neutral-400 leading-none truncate max-w-[45%] text-right">{steps[steps.length - 1].label}</span>
          </div>
        )}

        {expanded && (
          <div className="px-3 py-2 flex flex-col gap-1.5">
            {steps.map((step, i) => (
              <div key={step.cellId} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between py-0.5 px-1.5 rounded-lg hover:bg-violet-50/60 transition-colors">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={['w-1.5 h-1.5 rounded-full shrink-0', i === 0 ? 'bg-amber-400' : i === steps.length - 1 ? 'bg-emerald-400' : 'bg-violet-300'].join(' ')} />
                    <span className="text-[10px] text-neutral-600 truncate">{step.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500 font-medium">
                    {formatVal(step.value, step.isPercent, numberDecimals, percentMode, percentDecimals)}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex justify-end pr-2 py-0.5">
                    <div className="text-[9px] font-mono bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span>{step.opToNext ? OPERATOR_SYMBOL[step.opToNext] : '→'}</span>
                      {step.constantToNext != null && (
                        <span>{formatVal(step.constantToNext, step.constantIsPercentToNext, numberDecimals, percentMode, percentDecimals)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(isActive || (isOnMainPath && hasMainPath)) && (
          <div className="absolute inset-0 rounded-[18px] ring-1 ring-violet-300/50 pointer-events-none" />
        )}
      </div>
    </div>
  )
})
