import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { OperatorFlowNode, OperatorNodeData } from '../../types'
import { OPERATOR_COLORS, OPERATOR_LABELS } from '../../types'

export const OperatorNode = memo(function OperatorNode({ data }: NodeProps<OperatorFlowNode>) {
  const { operator, literalOperands } = data as OperatorNodeData
  const color = OPERATOR_COLORS[operator]
  const label = OPERATOR_LABELS[operator]

  return (
    <div
      className="flex min-h-[44px] min-w-[52px] items-center justify-center rounded-xl border bg-white px-3 py-2 shadow-sm"
      style={{ borderColor: color }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !bg-white"
        style={{ borderColor: color }}
      />

      <div className="text-center">
        <div className="text-lg font-bold leading-none" style={{ color }}>
          {label}
        </div>
        {literalOperands.length > 0 && (
          <div className="mt-1 text-[10px] font-mono text-neutral-500">
            {literalOperands.map((operand) => `${operand.side}:${operand.value}`).join(' · ')}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !bg-white"
        style={{ borderColor: color }}
      />
    </div>
  )
})
