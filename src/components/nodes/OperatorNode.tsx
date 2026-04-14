import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { OperatorFlowNode, OperatorNodeData } from '../../types'
import { OPERATOR_COLORS, OPERATOR_LABELS } from '../../types'
import { useFlowStore } from '../../store/flowStore'

function formatLiteralValue(value: number | string, isPercent: boolean) {
  if (typeof value === 'string') return value
  if (isPercent) {
    return (value * 100).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%'
  }
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export const OperatorNode = memo(function OperatorNode({ id, data }: NodeProps<OperatorFlowNode>) {
  const { operator, literalOperands } = data as OperatorNodeData
  const activeNodeIds = useFlowStore(s => s.activeNodeIds)
  const mainPathNodeIds = useFlowStore(s => s.mainPathNodeIds)
  const isActive = activeNodeIds.has(id)
  const isOnMainPath = mainPathNodeIds.size === 0 || mainPathNodeIds.has(id)

  const color = OPERATOR_COLORS[operator]
  const label = OPERATOR_LABELS[operator]
  const leftLiteral = literalOperands.find(item => item.side === 'left')
  const rightLiteral = literalOperands.find(item => item.side === 'right')

  return (
    <div className="relative flex items-center gap-2">
      {leftLiteral && (
        <span className="text-[11px] text-lpf-muted whitespace-nowrap min-w-[44px] text-right">
          {formatLiteralValue(leftLiteral.value, leftLiteral.isPercent)}
        </span>
      )}

      <div
        className={[
          'relative flex items-center justify-center rounded-full',
          'transition-all duration-500 cursor-default select-none',
          'border-2',
          isActive ? 'scale-110' : 'hover:scale-105',
        ].join(' ')}
        style={{
          width: 42,
          height: 42,
          opacity: isOnMainPath ? 1 : 0.5,
          borderColor: color,
          background: isActive
            ? '#e8e8e8'
            : `radial-gradient(circle at 30% 30%, ${color}22, rgba(39,39,42,0.96) 58%)`,
          boxShadow: isActive
            ? `0 0 0 2px ${color}18, 0 8px 18px rgba(0,0,0,0.08)`
            : `0 0 0 1px ${color}18, 0 6px 14px rgba(0,0,0,0.14)`,
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          style={{ borderColor: color, background: '#fafafa' }}
        />

        <span
          className="text-lg font-bold select-none transition-all duration-300"
          style={{ color: '#ffffff', textShadow: isActive ? 'none' : `0 0 8px ${color}55` }}
        >
          {label}
        </span>

        {isActive && (
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ border: `2px solid ${color}` }}
          />
        )}

        <Handle
          type="source"
          position={Position.Right}
          style={{ borderColor: color, background: '#fafafa' }}
        />
      </div>

      {rightLiteral && (
        <span className="text-[11px] text-lpf-muted whitespace-nowrap min-w-[44px]">
          {formatLiteralValue(rightLiteral.value, rightLiteral.isPercent)}
        </span>
      )}
    </div>
  )
})
