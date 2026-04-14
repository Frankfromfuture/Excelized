import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConstantFlowNode, ConstantNodeData } from '../../types'
import { useFlowStore } from '../../store/flowStore'

export const ConstantNode = memo(function ConstantNode({ id, data }: NodeProps<ConstantFlowNode>) {
  const { value } = data as ConstantNodeData
  const activeNodeIds = useFlowStore(s => s.activeNodeIds)
  const isActive = activeNodeIds.has(id)

  return (
    <div
      className={[
        'relative flex flex-col items-center justify-center rounded-xl px-3 py-2',
        'border transition-all duration-500 cursor-default select-none',
        isActive
          ? 'border-amber-400/70 bg-amber-900/20 shadow-[0_0_16px_rgba(245,158,11,0.4)]'
          : 'border-amber-700/40 bg-amber-900/10 hover:border-amber-500/50',
      ].join(' ')}
      style={{ minWidth: 56, minHeight: 56 }}
    >
      <span className="text-[9px] text-amber-400/60 uppercase tracking-wider mb-0.5">常量</span>
      <span className={[
        'text-base font-bold font-mono transition-colors duration-300',
        isActive ? 'text-amber-200' : 'text-amber-300/80',
      ].join(' ')}>
        {value}
      </span>

      <Handle
        type="source"
        position={Position.Right}
        style={{ borderColor: '#d97706', background: '#080808' }}
      />
    </div>
  )
})
