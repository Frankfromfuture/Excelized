import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CellFlowNode, CellNodeData } from '../../types'

function formatValue(value: number | string | null, isPercent: boolean) {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  if (isPercent) return `${(value * 100).toFixed(2)}%`
  return value.toLocaleString('zh-CN')
}

export const CellNode = memo(function CellNode({ data }: NodeProps<CellFlowNode>) {
  const { address, label, value, isInput, isOutput, isMarked, isPercent } = data as CellNodeData

  return (
    <div className="min-w-[180px] rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {!isInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-neutral-300 !bg-white"
        />
      )}

      <div className={['h-1.5 rounded-t-2xl', isMarked ? 'bg-violet-400' : 'bg-neutral-300'].join(' ')} />

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-800">{label?.trim() || address}</p>
            <p className="text-xs font-mono text-neutral-400">{address}</p>
          </div>
          <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
            {isOutput ? '输出' : isInput ? '输入' : '单元格'}
          </span>
        </div>

        <p className="text-lg font-semibold text-neutral-700">{formatValue(value, isPercent)}</p>
      </div>

      {!isOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-neutral-300 !bg-white"
        />
      )}
    </div>
  )
})
