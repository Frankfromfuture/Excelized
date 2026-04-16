import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { OperatorFlowNode, OperatorNodeData } from '../../types'
import { OPERATOR_COLORS, OPERATOR_LABELS } from '../../types'
import { useFlowStore } from '../../store/flowStore'

/** Render a literal operand value — large number, % as raised superscript */
function LiteralValue({ value, isPercent, color, displaySettings, sensitivityScore }: {
  value: number | string
  isPercent: boolean
  color: string
  displaySettings: { numberDecimals: number; percentMode: boolean; percentDecimals: number }
  sensitivityScore?: number
}) {
  if (typeof value === 'string') {
    return (
      <div className="relative flex flex-col items-center">
        <span style={{ fontSize: 17, fontWeight: 700, color: `${color}e6`, lineHeight: 1 }}>
          {value}
        </span>
      </div>
    )
  }

  const { numberDecimals, percentMode, percentDecimals } = displaySettings

  let renderContent = null

  if (isPercent && percentMode) {
    const numStr = (value * 100).toLocaleString('zh-CN', {
      minimumFractionDigits: percentDecimals,
      maximumFractionDigits: percentDecimals,
    })
    renderContent = (
      <span className="inline-flex items-start whitespace-nowrap leading-none">
        <span style={{ fontSize: 15, fontWeight: 700, color: `${color}f0`, lineHeight: 1 }}>
          {numStr}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: `${color}b0`, lineHeight: 1, marginTop: 1.5, marginLeft: 1.5 }}>
          %
        </span>
      </span>
    )
  } else {
    const dec = isPercent ? percentDecimals : numberDecimals
    const numStr = value.toLocaleString('zh-CN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    })
    renderContent = (
      <span style={{ fontSize: 15, fontWeight: 700, color: `${color}e0`, lineHeight: 1 }}>
        {numStr}
      </span>
    )
  }

  return (
    <div className="relative flex flex-col items-center pb-1">
      {renderContent}
      {sensitivityScore !== undefined && (
        <div 
          className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-200/60 rounded-sm overflow-hidden pointer-events-auto"
          title={`常数对结果的弹性敏感度：${(sensitivityScore * 100).toFixed(1)}%`}
        >
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-700 ease-out delay-150"
            style={{ width: `${sensitivityScore * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

export const OperatorNode = memo(function OperatorNode({ id, data }: NodeProps<OperatorFlowNode>) {
  const { operator, literalOperands } = data as OperatorNodeData
  const activeNodeIds   = useFlowStore(s => s.activeNodeIds)
  const hasMainPath     = useFlowStore(s => s.hasMainPath)
  const mainPathNodeIds = useFlowStore(s => s.mainPathNodeIds)
  const animationStatus = useFlowStore(s => s.animationStatus)
  const focusMainPath   = useFlowStore(s => s.focusMainPath)
  const isActive = activeNodeIds.has(id)
  const isOnMainPath = !hasMainPath || mainPathNodeIds.has(id)
  const isPlaying = animationStatus !== 'idle'
  const isOffFocus  = focusMainPath && !isOnMainPath
  const nodeOpacity = isOffFocus ? 0.32 : (isPlaying && hasMainPath && !isOnMainPath ? 0 : isOnMainPath ? 1 : 0.32)
  const nodeFilter  = isOffFocus ? 'grayscale(1) brightness(1.08)' : 'none'
  const showMainGlow = hasMainPath && isOnMainPath && !isActive
  const displaySettings = useFlowStore(s => s.displaySettings)

  const color = OPERATOR_COLORS[operator]
  const label = OPERATOR_LABELS[operator]
  const leftLiteral  = literalOperands.find(item => item.side === 'left')
  const rightLiteral = literalOperands.find(item => item.side === 'right')
  const hasLiterals  = !!(leftLiteral || rightLiteral)
  const sensitivityMap = useFlowStore(s => s.sensitivityMap)

  const leftSen = sensitivityMap?.[`${id}_literal_left`]
  const rightSen = sensitivityMap?.[`${id}_literal_right`]

  return (
    <div
      className={[
        'relative flex flex-col items-center justify-center',
        'transition-all duration-500 cursor-default select-none',
        isActive ? 'scale-[1.08]' : showMainGlow ? 'scale-[1.03]' : 'hover:scale-[1.03]',
      ].join(' ')}
      style={{
        width: hasLiterals ? 68 : 44,
        height: hasLiterals ? 52 : 38,
        borderRadius: 10,
        border: `${showMainGlow ? 2 : 1.5}px solid ${color}`,
        background: isActive
          ? '#e8e8e8'
          : `linear-gradient(160deg, ${color}1e 0%, ${color}06 100%)`,
        boxShadow: isActive
          ? `0 0 0 2px ${color}20, 0 6px 14px rgba(0,0,0,0.08)`
          : showMainGlow
            ? `0 0 0 1.5px ${color}28, 0 0 14px ${color}28, 0 4px 12px rgba(0,0,0,0.09)`
            : `0 0 0 1px ${color}12, 0 2px 8px rgba(0,0,0,0.08)`,
        opacity: nodeOpacity,
        filter: nodeFilter,
        transition: 'opacity 1.5s ease, filter 1.5s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: color, background: '#fafafa' }}
      />

      {/* Operator symbol */}
      <span
        className="font-bold leading-none select-none transition-all duration-300"
        style={{
          fontSize: hasLiterals ? 15 : 17,
          marginTop: hasLiterals ? 2 : 0,
          color: isActive ? '#1a1a1a' : color,
          textShadow: isActive
            ? 'none'
            : showMainGlow
              ? `0 0 10px ${color}88`
              : `0 0 6px ${color}44`,
        }}
      >
        {label}
      </span>

      {/* Literal constants row */}
      {hasLiterals && (
        <div className="flex items-center gap-1 mt-1">
          {leftLiteral && (
            <LiteralValue value={leftLiteral.value} isPercent={leftLiteral.isPercent} color={color} displaySettings={displaySettings} sensitivityScore={isOnMainPath ? leftSen : undefined} />
          )}
          {leftLiteral && rightLiteral && (
            <span style={{ fontSize: 9, color: `${color}55`, alignSelf: 'flex-start', marginTop: 2 }}>·</span>
          )}
          {rightLiteral && (
            <LiteralValue value={rightLiteral.value} isPercent={rightLiteral.isPercent} color={color} displaySettings={displaySettings} sensitivityScore={isOnMainPath ? rightSen : undefined} />
          )}
        </div>
      )}

      {/* Main path expanding pulse ring */}
      {showMainGlow && (
        <div
          className="op-ring-pulse absolute inset-0 pointer-events-none"
          style={{ border: `1.5px solid ${color}`, borderRadius: 8 }}
        />
      )}

      {/* Active ping */}
      {isActive && (
        <div
          className="absolute inset-0 animate-ping opacity-25 pointer-events-none"
          style={{ border: `1.5px solid ${color}`, borderRadius: 8 }}
        />
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: color, background: '#fafafa' }}
      />
    </div>
  )
})
