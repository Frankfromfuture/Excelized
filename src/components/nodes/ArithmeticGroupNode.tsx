import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { ArithmeticGroupFlowNode, ArithmeticGroupNodeData, Operator } from '../../types'
import { useFlowStore } from '../../store/flowStore'

const OPERATOR_SYMBOL: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

const OPERATOR_WORD: Record<Operator, string> = {
  '+': '加',
  '-': '减',
  '*': '乘',
  '/': '除',
}

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

function formatConstant(k: number, isPercent: boolean, pctMode: boolean, pctDec: number, numDec: number): string {
  if (isPercent && pctMode) {
    return (k * 100).toLocaleString('zh-CN', {
      minimumFractionDigits: pctDec,
      maximumFractionDigits: pctDec,
    }) + '%'
  }
  return k.toLocaleString('zh-CN', {
    minimumFractionDigits: numDec,
    maximumFractionDigits: numDec,
  })
}

export const ArithmeticGroupNode = memo(function ArithmeticGroupNode({
  id,
  data,
}: NodeProps<ArithmeticGroupFlowNode>) {
  const {
    memberIds,
    memberLabels,
    memberValues,
    memberIsPercent,
    operator,
    constant,
    constantIsPercent,
    annotation,
  } = data as ArithmeticGroupNodeData

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

  const constStr = formatConstant(constant, constantIsPercent, percentMode, percentDecimals, numberDecimals)
  const opSym = OPERATOR_SYMBOL[operator]
  const opWord = OPERATOR_WORD[operator]
  const count = memberIds.length

  // Card visual state
  const borderCls = isActive
    ? 'border-emerald-500'
    : isOnMainPath && hasMainPath
      ? 'border-emerald-400/90'
      : 'border-emerald-300/70 hover:border-emerald-400/80'

  const glowCls = isActive
    ? 'shadow-[0_0_24px_rgba(52,211,153,0.35)]'
    : isOnMainPath && hasMainPath
      ? 'shadow-[0_0_18px_rgba(52,211,153,0.25)]'
      : 'shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_0_16px_rgba(52,211,153,0.20)]'

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
          'w-[240px]',
          'transition-all duration-300 cursor-default select-none',
          isHovered ? 'scale-[1.02]' : 'scale-100',
          'backdrop-blur-sm bg-white/95',
          borderCls,
          glowCls,
        ].join(' ')}
      >
        {/* Handles */}
        <Handle
          type="target"
          position={Position.Left}
          className="!border-emerald-300 !bg-emerald-50 !w-2.5 !h-2.5"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!border-emerald-300 !bg-emerald-50 !w-2.5 !h-2.5"
        />

        {/* Top accent gradient bar */}
        <div className="h-[3px] w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

        {/* Header */}
        <div className="px-3.5 pt-2.5 pb-2">
          <div className="flex items-center justify-between gap-2">
            {/* Left: icon + title */}
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Group icon */}
              <div className="shrink-0 w-5 h-5 rounded-md bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="1" width="4" height="4" rx="1" fill="#34d399" />
                  <rect x="7" y="1" width="4" height="4" rx="1" fill="#34d399" />
                  <rect x="1" y="7" width="4" height="4" rx="1" fill="#34d399" />
                  <rect x="7" y="7" width="4" height="4" rx="1" fill="#34d399" />
                </svg>
              </div>
              <span className="text-[12px] font-semibold text-emerald-800 truncate leading-none">
                同规律组
              </span>
            </div>

            {/* Right: operator badge + count + expand toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Operator + constant badge */}
              <div className="flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <span className="text-[10px] font-bold font-mono text-emerald-700">
                  {opSym} {constStr}
                </span>
              </div>
              {/* Count */}
              <div className="text-[9px] font-mono text-emerald-600/70 leading-none">
                {count}项
              </div>
              {/* Expand toggle */}
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-4 h-4 rounded flex items-center justify-center text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                title={expanded ? '折叠' : '展开'}
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

          {/* Annotation */}
          <p className="text-[10px] text-emerald-700/70 mt-1.5 leading-[1.5] font-medium">
            {annotation}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-emerald-100 mx-3.5" />

        {/* Collapsed summary row */}
        {!expanded && (
          <div className="px-3.5 py-2 flex items-center justify-between">
            <span className="text-[10px] text-neutral-400 leading-none">
              {memberLabels.slice(0, 2).join('、')}{count > 2 ? ` … 等 ${count} 项` : ''}
            </span>
            <span className="text-[10px] font-mono font-semibold text-emerald-600/60 leading-none">
              均{opWord} {constStr}
            </span>
          </div>
        )}

        {/* Expanded member list */}
        {expanded && (
          <div className="px-3 py-2 flex flex-col gap-1">
            {memberIds.map((mid, i) => {
              const label = memberLabels[i] || mid
              const rawVal = memberValues[i]
              const isPct = memberIsPercent[i] ?? false
              const valStr = formatVal(rawVal, isPct, numberDecimals, percentMode, percentDecimals)
              return (
                <div
                  key={mid}
                  className="flex items-center justify-between gap-2 py-0.5 px-1.5 rounded-lg hover:bg-emerald-50/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-[10px] text-neutral-600 truncate">{label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono text-neutral-400">{valStr}</span>
                    <span className="text-[9px] text-emerald-400 font-mono">{opSym}{constStr}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Active glow ring */}
        {(isActive || (isOnMainPath && hasMainPath)) && (
          <div className="absolute inset-0 rounded-[18px] ring-1 ring-emerald-300/50 pointer-events-none" />
        )}
      </div>
    </div>
  )
})
