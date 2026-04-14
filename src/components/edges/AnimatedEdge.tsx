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
  const mainPathEdgeIds = useFlowStore(s => s.mainPathEdgeIds)
  const isActive = activeEdgeIds.has(id)
  const isOnMainPath = mainPathEdgeIds.size === 0 || mainPathEdgeIds.has(id)
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
        strokeWidth={isActive ? 3.5 : 3}
        fill="none"
        strokeOpacity={isOnMainPath ? 0.2 : 0.1}
      />

      {/* Animated flowing dashes */}
      <path
        d={edgePath}
        stroke={color}
        strokeWidth={isActive ? 4.5 : 3.5}
        fill="none"
        strokeOpacity={isActive ? 0.95 : isOnMainPath ? 0.62 : 0.31}
        strokeDasharray="10 6"
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
          refX="4.5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 1 2 L 7 5 L 1 8" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity={isActive ? 0.9 : isOnMainPath ? 0.58 : 0.29} />
        </marker>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={4}
        markerEnd={`url(#arrow-${id})`}
      />
    </>
  )
})
