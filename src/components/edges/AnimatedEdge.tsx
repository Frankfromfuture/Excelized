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
  const activeEdgeIds   = useFlowStore(s => s.activeEdgeIds)
  const hasMainPath     = useFlowStore(s => s.hasMainPath)
  const mainPathEdgeIds = useFlowStore(s => s.mainPathEdgeIds)
  const animationStatus = useFlowStore(s => s.animationStatus)
  const focusMainPath   = useFlowStore(s => s.focusMainPath)
  const isActive = activeEdgeIds.has(id)
  const isOnMainPath = !hasMainPath || mainPathEdgeIds.has(id)
  const isMainPath  = hasMainPath && isOnMainPath
  const isPlaying   = animationStatus !== 'idle'
  const isOffFocus  = focusMainPath && !isOnMainPath
  // During playback hide off-path edges; in focus mode keep them visible but grey
  const isHidden    = !isOffFocus && isPlaying && hasMainPath && !isOnMainPath

  const operator = data?.operator ?? '+'
  const color = OPERATOR_COLORS[operator] ?? '#8b5cf6'

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.25,
  })

  // Sizing tiers
  const baseW     = isActive ? 3   : isMainPath ? 4   : 2
  const dashW     = isActive ? 4.5 : isMainPath ? 6   : 2.5
  const dashGap   = isMainPath ? '10 7' : '7 6'
  const flowSpeed = isMainPath ? '0.55s' : '1.6s'
  const baseOpacity  = isMainPath ? 0.22 : (isOnMainPath ? 0.14 : 0.04)
  const dashOpacity  = isActive ? 0.92 : isMainPath ? 0.82 : (isOnMainPath ? 0.48 : 0.12)
  const arrowOpacity = isActive ? 0.90 : isMainPath ? 0.76 : (isOnMainPath ? 0.42 : 0.12)
  const arrowSize    = isMainPath ? 6 : 4.5

  return (
    <g style={{
      opacity: isHidden ? 0 : isOffFocus ? 0.22 : 1,
      filter: isOffFocus ? 'grayscale(1)' : 'none',
      transition: 'opacity 0.35s ease, filter 0.4s ease',
    }}>
      {/* ── Glow halo — main path only ── */}
      {isMainPath && (
        <path
          d={edgePath}
          stroke={color}
          strokeWidth={13}
          strokeLinecap="round"
          fill="none"
          strokeOpacity={0.055}
        />
      )}

      {/* ── Base path ── */}
      <path
        d={edgePath}
        stroke={color}
        strokeWidth={baseW}
        strokeLinecap="round"
        fill="none"
        strokeOpacity={baseOpacity}
        style={{ transition: 'stroke-width 0.4s, stroke-opacity 0.4s' }}
      />

      {/* ── Animated flowing dashes ── */}
      <path
        d={edgePath}
        stroke={color}
        strokeWidth={dashW}
        fill="none"
        strokeOpacity={dashOpacity}
        strokeDasharray={dashGap}
        strokeLinecap="round"
        style={{
          animation: `flow ${flowSpeed} linear infinite`,
          filter: isActive
            ? `drop-shadow(0 0 4px ${color}cc)`
            : isMainPath
              ? `drop-shadow(0 0 2px ${color}88)`
              : 'none',
          transition: 'stroke-opacity 0.4s, stroke-width 0.4s',
        }}
      />

      {/* ── Arrow head ── */}
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="4.5"
          refY="5"
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          orient="auto-start-reverse"
        >
          <path
            d="M 1 2.5 L 6.5 5 L 1 7.5"
            fill="none"
            stroke={color}
            strokeWidth={isMainPath ? 1.6 : 1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={arrowOpacity}
          />
        </marker>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={isMainPath ? 6 : 4}
        markerEnd={`url(#arrow-${id})`}
      />
    </g>
  )
})
