import { memo, useState, useMemo, useCallback } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { CellFlowNode, CellNodeData } from '../../types'
import { useFlowStore } from '../../store/flowStore'

function formatValue(
  v: number | string | null,
  isPercent: boolean,
  numDec: number,
  pctMode: boolean,
  pctDec: number,
): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number') {
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
  return String(v)
}

/** Replace cell references in a formula with human labels where available. */
function prettifyFormula(formula: string, labelMap: Map<string, string>): string {
  // Replace $A$1, A$1, $A1, A1 style refs — longest addresses first to avoid partial hits
  const cellRefRe = /\$?[A-Z]{1,3}\$?[0-9]{1,7}/gi
  return formula.replace(cellRefRe, match => {
    const normalized = match.replace(/\$/g, '').toUpperCase()
    const label = labelMap.get(normalized)
    // Only substitute if label looks like a meaningful name, not just another address
    return (label && !/^[A-Z]{1,3}\d+$/i.test(label)) ? label : match
  })
}

export const CellNode = memo(function CellNode({ id, data }: NodeProps<CellFlowNode>) {
  const { address, value, label, formula, isInput, isOutput, isMarked, isPercent } = data as CellNodeData
  const activeNodeIds    = useFlowStore(s => s.activeNodeIds)
  const hasMainPath      = useFlowStore(s => s.hasMainPath)
  const mainPathNodeIds  = useFlowStore(s => s.mainPathNodeIds)
  const animationStatus  = useFlowStore(s => s.animationStatus)
  const focusMainPath    = useFlowStore(s => s.focusMainPath)
  const allNodes         = useFlowStore(s => s.nodes)
  const { numberDecimals, percentMode, percentDecimals } = useFlowStore(s => s.displaySettings)

  const isActive = activeNodeIds.has(id)
  const isOnMainPath = !hasMainPath || mainPathNodeIds.has(id)
  const isPlaying = animationStatus !== 'idle'
  const isOffFocus = focusMainPath && !isOnMainPath
  // In focus mode keep off-path nodes visible (grey); outside focus use existing dim/hide logic
  const nodeOpacity = isOffFocus ? 0.32 : (isPlaying && hasMainPath && !isOnMainPath ? 0 : isOnMainPath ? 1 : 0.32)
  const nodeFilter  = isOffFocus ? 'grayscale(1) brightness(1.08)' : 'none'

  const { setNodes } = useReactFlow()
  const [isHovered, setIsHovered] = useState(false)

  const onMouseEnter = useCallback(() => {
    setIsHovered(true)
    setNodes(nds => nds.map(n => n.id === id ? { ...n, zIndex: 9999 } : n))
  }, [id, setNodes])

  const onMouseLeave = useCallback(() => {
    setIsHovered(false)
    setNodes(nds => nds.map(n => n.id === id ? { ...n, zIndex: 0 } : n))
  }, [id, setNodes])

  // Build address → label map once per graph load
  const labelMap = useMemo(() => {
    const map = new Map<string, string>()
    allNodes.forEach(n => {
      if (n.type === 'cellNode' && n.data.label?.trim()) {
        map.set(n.data.address.toUpperCase(), n.data.label.trim())
      }
    })
    return map
  }, [allNodes])

  // Formula with cell addresses substituted by labels
  const displayFormula = useMemo(
    () => formula ? prettifyFormula(formula, labelMap) : null,
    [formula, labelMap],
  )

  // Only show tooltip for calc cells (has formula), when not hidden
  const showTooltip = isHovered && !!displayFormula && nodeOpacity > 0

  // ── Card state variants ────────────────────────────────────────────────────
  const isStart  = isMarked && !isOutput
  const isEnd    = isMarked && isOutput
  const showMainGlow = hasMainPath && isOnMainPath && !isActive

  let borderCls: string, topBarCls: string, valueCls: string, glowCls: string, cardBgCls: string, titleCls: string, dividerCls: string, ringCls: string
  if (isActive) {
    borderCls  = 'border-lpf-border-light'
    topBarCls  = isEnd ? 'bg-emerald-500' : isStart ? 'bg-amber-500' : isPercent ? 'bg-sky-700/70' : 'bg-lpf-subtle'
    valueCls   = isEnd ? 'text-emerald-300' : isStart ? 'text-amber-300' : 'text-lpf-text'
    glowCls    = 'shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
    cardBgCls  = 'bg-[#e8e8e8]'
    titleCls   = 'text-lpf-text'
    dividerCls = 'bg-black/6'
    ringCls    = 'ring-black/8'
  } else if (isEnd) {
    borderCls  = showMainGlow ? 'border-emerald-400/90' : 'border-emerald-500/60'
    topBarCls  = 'bg-emerald-500'
    valueCls   = 'text-emerald-600'
    glowCls    = showMainGlow ? 'main-path-glow-end' : 'shadow-[0_0_14px_rgba(16,185,129,0.18)]'
    cardBgCls  = 'bg-lpf-card'
    titleCls   = 'text-lpf-text'
    dividerCls = 'bg-black/6'
    ringCls    = 'ring-emerald-200/60'
  } else if (isStart) {
    borderCls  = showMainGlow ? 'border-amber-400/90' : 'border-amber-500/60'
    topBarCls  = 'bg-amber-500'
    valueCls   = 'text-amber-600'
    glowCls    = showMainGlow ? 'main-path-glow-start' : 'shadow-[0_0_14px_rgba(245,158,11,0.18)]'
    cardBgCls  = 'bg-lpf-card'
    titleCls   = 'text-lpf-text'
    dividerCls = 'bg-black/6'
    ringCls    = 'ring-amber-200/60'
  } else if (showMainGlow) {
    borderCls  = 'border-indigo-300/70'
    topBarCls  = isPercent ? 'bg-sky-500/80' : 'bg-indigo-400/70'
    valueCls   = 'text-lpf-text'
    glowCls    = 'main-path-glow-mid'
    cardBgCls  = 'bg-lpf-card'
    titleCls   = 'text-lpf-text'
    dividerCls = 'bg-black/5'
    ringCls    = 'ring-indigo-200/50'
  } else {
    borderCls  = 'border-lpf-border hover:border-lpf-border-light'
    topBarCls  = isPercent ? 'bg-sky-700/70' : 'bg-lpf-subtle'
    valueCls   = 'text-lpf-text'
    glowCls    = 'hover:shadow-glow'
    cardBgCls  = 'bg-lpf-card'
    titleCls   = 'text-lpf-text'
    dividerCls = 'bg-white/5'
    ringCls    = 'ring-white/20'
  }

  // ── Badge ──────────────────────────────────────────────────────────────────
  let badge: { text: string; cls: string } | null = null
  if (isStart)                  badge = { text: '起点', cls: 'bg-amber-900/50 text-amber-300 border-amber-700/50' }
  else if (isEnd)               badge = { text: '终点', cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50' }
  else if (!isMarked && isInput)  badge = { text: '输入', cls: 'bg-white/5 text-white/50 border-white/10' }
  else if (!isMarked && isOutput) badge = { text: '结果', cls: 'bg-sky-900/40 text-sky-300/80 border-sky-700/30' }

  const displayValue = formatValue(value, isPercent, numberDecimals, percentMode, percentDecimals)
  const hasLabel = !!label
  const displayAddress = address.replace(/^([A-Z]+)(\d+)$/i, '$1$2')
  const hoverScale  = isHovered ? 'scale-[1.03]' : 'scale-100'
  const hoverShadow = isHovered ? 'shadow-[0_6px_20px_rgba(15,23,42,0.10)]' : ''

  return (
    <div
      className="relative"
      style={{
        opacity: nodeOpacity,
        filter: nodeFilter,
        transition: 'opacity 0.35s ease, filter 0.4s ease',
        pointerEvents: nodeOpacity === 0 ? 'none' : 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* ── Formula tooltip ───────────────────────────────────────────────── */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-[10000] pointer-events-none">
          <div className="relative bg-[#1e2227] rounded-[13px] px-5 pt-4 pb-1 border border-white/[0.07] min-w-[260px] max-w-[460px] shadow-[0_16px_48px_rgba(0,0,0,0.42)] inline-block w-max">
            {/* Header */}
            <p className="text-[20px] font-mono text-white/30 uppercase tracking-[0.22em] mb-2.5 leading-none select-none">
              {address} · 公式
            </p>

            {/* Pretty formula */}
            <p className="text-[26px] font-mono text-[#dde3ea] leading-none break-all">
              {displayFormula}
            </p>

            {/* Raw formula — only if substitution actually changed something */}
            {displayFormula !== formula && (
              <p className="text-[22px] font-mono text-white/32 leading-none mt-2.5 break-all border-t border-white/[0.06] pt-2.5">
                {formula}
              </p>
            )}

            {/* Down-arrow caret */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-[10px] h-[10px] bg-[#1e2227] border-r border-b border-white/[0.07] rotate-45 -mt-[5px]" />
          </div>
        </div>
      )}

      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <div
        className={[
          'relative rounded-[16px] border overflow-hidden',
          'w-[196px]',
          'transition-all duration-300 cursor-default select-none origin-center',
          hoverScale,
          hoverShadow,
          'backdrop-blur-sm',
          cardBgCls,
          borderCls,
          glowCls,
        ].join(' ')}
      >
        {/* Input handle */}
        {!isInput && (
          <Handle type="target" position={Position.Left}
            className="!border-lpf-subtle !bg-lpf-bg !w-2.5 !h-2.5" />
        )}

        {/* Accent top bar — thicker on main path */}
        <div className={`${showMainGlow ? 'h-[3px]' : 'h-[2px]'} w-full ${topBarCls} transition-all duration-300`} />

        {/* Body */}
        <div className="px-3.5 pt-2.5 pb-3">

          {/* Header row */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1 min-w-0">
              {hasLabel ? (
                <p className={`leading-[1.08] font-semibold line-clamp-2 transition-[font-size] duration-200 ${titleCls}`} style={{ fontSize: isHovered ? 21 : 18 }} title={label!}>
                  {label}
                </p>
              ) : (
                <p className={`leading-[1.08] font-mono transition-[font-size] duration-200 ${titleCls}`} style={{ fontSize: isHovered ? 21 : 18 }}>
                  {displayAddress}
                </p>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <div className={`flex items-center justify-center rounded-full border font-mono font-bold tracking-[0.02em] min-w-7 h-7 px-1.5 text-[9px] ${isActive ? 'border-black/15 bg-black/5 text-lpf-text' : 'border-lpf-border bg-lpf-bg/90 text-lpf-subtle'}`}>
                {displayAddress}
              </div>
              {badge && (
                <span className={`shrink-0 text-[8px] px-1.5 py-0.5 rounded-sm tracking-[0.13em] font-bold border leading-none ${badge.cls}`}>
                  {badge.text}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className={`h-px ${dividerCls} mb-1.5`} />

          {/* Value */}
          <div className="flex items-end justify-between gap-2.5">
            <div className={`min-w-0 font-bold font-mono tracking-[-0.02em] leading-[0.96] transition-[font-size,color] duration-200 ${valueCls}`} style={{ fontSize: isHovered ? 22 : 18 }}>
              {displayValue}
            </div>

            {/* Percent type indicator */}
            {isPercent && !isMarked && (
              <div className="shrink-0 rounded border border-sky-500/20 bg-sky-500/8 px-1.5 py-0.5 text-[7px] tracking-[0.12em] text-sky-600/70 uppercase font-semibold leading-none">参数</div>
            )}
          </div>
        </div>

        {/* Main path steady ring (non-active) */}
        {showMainGlow && (
          <div className={`absolute inset-0 rounded-[16px] ring-1 ${ringCls} pointer-events-none`} />
        )}

        {/* Active ring */}
        {isActive && (
          <div className={`absolute inset-0 rounded-[16px] ring-1 ${ringCls} pointer-events-none`} />
        )}

        {/* Output handle */}
        <Handle type="source" position={Position.Right}
          className="!border-lpf-subtle !bg-lpf-bg !w-2.5 !h-2.5" />
      </div>
    </div>
  )
})
