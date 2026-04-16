import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { ValueDuplicateFlowNode, ValueDuplicateNodeData } from '../../types'
import { useFlowStore } from '../../store/flowStore'

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

export const ValueDuplicateNode = memo(function ValueDuplicateNode({
  id,
  data,
}: NodeProps<ValueDuplicateFlowNode>) {
  const {
    value,
    isPercent,
    memberIds,
    memberLabels,
    annotation,
  } = data as ValueDuplicateNodeData

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

  const valStr = formatVal(value, isPercent, numberDecimals, percentMode, percentDecimals)
  const count = memberIds.length

  const borderCls = isActive
    ? 'border-amber-500'
    : isOnMainPath && hasMainPath
      ? 'border-amber-400/90'
      : 'border-amber-300/70 hover:border-amber-400/80'

  const glowCls = isActive
    ? 'shadow-[0_0_24px_rgba(251,191,36,0.35)]'
    : isOnMainPath && hasMainPath
      ? 'shadow-[0_0_18px_rgba(251,191,36,0.25)]'
      : 'shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_0_16px_rgba(251,191,36,0.20)]'

  return (
    <div
      style={{
        opacity: nodeOpacity,
        filter: nodeFilter,
        transition: 'opacity 1.5s ease, filter 1.5s ease',
        pointerEvents: nodeOpacity === 0 ? 'none' : 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={[
          'relative rounded-[18px] border overflow-hidden',
          'w-[220px]',
          'transition-all duration-300 cursor-default select-none',
          isHovered ? 'scale-[1.02]' : 'scale-100',
          'backdrop-blur-sm bg-white/95',
          borderCls,
          glowCls,
        ].join(' ')}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!border-amber-300 !bg-amber-50 !w-2.5 !h-2.5"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!border-amber-300 !bg-amber-50 !w-2.5 !h-2.5"
        />

        {/* Top gradient bar */}
        <div className="h-[3px] w-full bg-gradient-to-r from-amber-400 to-orange-400" />

        <div className="px-3.5 pt-2.5 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="shrink-0 w-5 h-5 rounded-md bg-amber-100 border border-amber-200 flex items-center justify-center">
                <span className="text-[12px] font-bold text-amber-600">≡</span>
              </div>
              <span className="text-[12px] font-semibold text-amber-800 truncate leading-none">
                同值常数
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-0.5 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <span className="text-[10px] font-bold font-mono text-amber-700">
                  {valStr}
                </span>
              </div>
              <div className="text-[9px] font-mono text-amber-600/70 leading-none">
                {count}项
              </div>
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-4 h-4 rounded flex items-center justify-center text-amber-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                >
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <p className="text-[10px] text-amber-700/70 mt-1.5 leading-[1.5] font-medium">
            {annotation}
          </p>
        </div>

        <div className="h-px bg-amber-100 mx-3.5" />

        {!expanded && (
          <div className="px-3.5 py-2 flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 leading-none truncate max-w-[80%]">
              {memberLabels.slice(0, 2).join('、')}{count > 2 ? ` 等 ${count} 项` : ''}
            </span>
          </div>
        )}

        {expanded && (
          <div className="px-3 py-2 flex flex-col gap-1">
            {memberIds.map((mid, i) => (
              <div
                key={mid}
                className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded-lg hover:bg-amber-50/60 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[10px] text-neutral-600 truncate">{memberLabels[i] || mid}</span>
                </div>
                <span className="text-[9px] font-mono text-neutral-400">{mid}</span>
              </div>
            ))}
          </div>
        )}

        {(isActive || (isOnMainPath && hasMainPath)) && (
          <div className="absolute inset-0 rounded-[18px] ring-1 ring-amber-300/50 pointer-events-none" />
        )}
      </div>
    </div>
  )
})
