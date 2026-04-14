import { memo } from 'react'
import {
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { FlowEdgeData } from '../../types'
import { OPERATOR_COLORS } from '../../types'
import { useFlowStore } from '../../store/flowStore'

export const AnimatedEdge = memo(function AnimatedEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const activeEdgeIds = useFlowStore(s => s.activeEdgeIds)
  const isActive = activeEdgeIds.has(id)
  const operator = data?.operator ?? '+'
  const color = OPERATOR_COLORS[operator] ?? '#8b5cf6'

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.3,
  })

  return (
    <>
      {/* Base path (dim) */}
      <path
        d={edgePath}
        stroke={color}
        strokeWidth={isActive ? 0 : 1.5}
        fill="none"
        strokeOpacity={0.25}
      />

      {/* Animated flowing dashes */}
      <path
        d={edgePath}
        stroke={color}
        strokeWidth={isActive ? 2.5 : 1.5}
        fill="none"
        strokeOpacity={isActive ? 0.9 : 0.45}
        strokeDasharray="8 5"
        style={{
          animation: 'flow 1.2s linear infinite',
          filter: isActive ? `drop-shadow(0 0 4px ${color})` : 'none',
          transition: 'stroke-opacity 0.4s, stroke-width 0.4s',
        }}
      />

      {/* Arrow head */}
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity={isActive ? 0.9 : 0.45} />
        </marker>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={1}
        markerEnd={`url(#arrow-${id})`}
      />
    </>
  )
})
