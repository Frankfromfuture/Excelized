import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import type { FlowEdgeData } from '../../types'
import { OPERATOR_COLORS } from '../../types'

export const AnimatedEdge = memo(function AnimatedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const operator = data?.operator ?? '+'
  const stroke = OPERATOR_COLORS[operator] ?? '#94a3b8'

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.2,
  })

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke,
        strokeWidth: 2,
        opacity: 0.85,
      }}
    />
  )
})
