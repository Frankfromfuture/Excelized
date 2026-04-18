import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { BranchFlowNode, BranchNodeData } from '../../types'

export const BranchNode = memo(function BranchNode({ data }: NodeProps<BranchFlowNode>) {
  const branchData = data as BranchNodeData

  return (
    <div className="min-w-[180px] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-amber-300 !bg-white"
      />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Branch</p>
        <p className="text-sm font-medium text-neutral-800">{branchData.condition}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600">
          <div className="rounded-xl border border-amber-200 bg-white px-2 py-1.5">
            <p className="font-semibold text-emerald-700">True</p>
            <p className="mt-1 break-all">{branchData.trueLabel}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white px-2 py-1.5">
            <p className="font-semibold text-rose-700">False</p>
            <p className="mt-1 break-all">{branchData.falseLabel}</p>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-amber-300 !bg-white"
      />
    </div>
  )
})
