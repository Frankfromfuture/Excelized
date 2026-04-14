import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { OperatorFlowNode, OperatorNodeData } from '../../types'
import { OPERATOR_COLORS, OPERATOR_LABELS, OPERATOR_SHADOW } from '../../types'
import { useFlowStore } from '../../store/flowStore'

export const OperatorNode = memo(function OperatorNode({ id, data }: NodeProps<OperatorFlowNode>) {
  const { operator } = data as OperatorNodeData
  const activeNodeIds = useFlowStore(s => s.activeNodeIds)
  const isActive = activeNodeIds.has(id)

  const color = OPERATOR_COLORS[operator]
  const label = OPERATOR_LABELS[operator]
  const shadow = OPERATOR_SHADOW[operator]

  return (
    <div
      className={[
        'relative flex items-center justify-center rounded-full',
        'transition-all duration-500 cursor-default select-none',
        'border-2',
        isActive ? 'scale-110' : 'hover:scale-105',
      ].join(' ')}
      style={{
        width: 64,
        height: 64,
        borderColor: color,
        backgroundColor: `${color}18`,
        boxShadow: isActive ? `${shadow}, 0 0 0 3px ${color}30` : `0 0 12px ${color}25`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ borderColor: color, background: '#080808' }}
      />

      <span
        className="text-2xl font-bold select-none transition-all duration-300"
        style={{ color, textShadow: isActive ? `0 0 12px ${color}` : 'none' }}
      >
        {label}
      </span>

      {/* Pulse ring when active */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ border: `2px solid ${color}` }}
        />
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: color, background: '#080808' }}
      />
    </div>
  )
})
