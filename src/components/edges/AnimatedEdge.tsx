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
  const introState      = useFlowStore(s => s.introState)
  const isActive = activeEdgeIds.has(id)
  const isOnMainPath = !hasMainPath || mainPathEdgeIds.has(id)
  const isMainPath  = hasMainPath && isOnMainPath
  const isPlaying   = animationStatus !== 'idle'
  const isOffFocus  = focusMainPath && !isOnMainPath
  // During playback hide off-path edges; in focus mode keep them visible but grey
  const isHidden    = !isOffFocus && isPlaying && hasMainPath && !isOnMainPath

  const drawDelay = Math.min(Math.max(0, sourceX) / 1200 * 0.7, 0.7) // sequential delay
  const isConnecting = introState === 'connecting_edges'
  const isIntroDone = introState === 'idle' || introState === 'done' || introState === 'unfocused'

  let edgeGroupOpacity = 1
  if (introState === 'moving_cards') edgeGroupOpacity = 0
  else if (isHidden) edgeGroupOpacity = 0
  else if (isOffFocus) edgeGroupOpacity = 0.22

  const operator = data?.operator ?? '+'
  const color = OPERATOR_COLORS[operator] ?? '#8b5cf6'

  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.25,
  })

  // Sizing tiers
  const baseW     = isActive ? 2 : isMainPath ? 2.5 : 1.5
  const dashW     = isActive ? 4 : isMainPath ? 5   : 3    // Dot size
  const dashGap   = isMainPath ? '0 12' : '0 10'           // 0 length + round linecap = dot!
  const flowSpeed = isMainPath ? '0.55s' : '1.6s'
  const baseOpacity  = isMainPath ? 0.35 : (isOnMainPath ? 0.25 : 0.08)
  const dashOpacity  = isActive ? 0.92 : isMainPath ? 0.82 : (isOnMainPath ? 0.55 : 0.15)
  const arrowOpacity = isActive ? 0.90 : isMainPath ? 0.76 : (isOnMainPath ? 0.42 : 0.12)
  const arrowSize    = isMainPath ? 5.5 : 4

  return (
    <g style={{
      opacity: edgeGroupOpacity,
      filter: isOffFocus ? 'grayscale(1)' : 'none',
      transition: isConnecting 
        ? `opacity 0.2s ease-in ${drawDelay}s` 
        : 'opacity 1.5s ease, filter 1.5s ease',
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
        strokeDasharray={isIntroDone ? undefined : 3000}
        strokeDashoffset={introState === 'moving_cards' ? 3000 : 0}
        style={{ 
          transition: isConnecting 
            ? `stroke-dashoffset 0.6s ease-out ${drawDelay}s` 
            : 'd 1.5s cubic-bezier(0.4, 0, 0.2, 1), stroke-width 1.5s, stroke-opacity 1.5s' 
        }}
      />

      {/* ── Animated flowing dashes ── */}
      <path
        d={edgePath}
        stroke={color}
        strokeWidth={dashW}
        fill="none"
        strokeOpacity={isIntroDone ? dashOpacity : 0}
        strokeDasharray={dashGap}
        strokeLinecap="round"
        style={{
          animation: `flow ${flowSpeed} linear infinite`,
          filter: isActive
            ? `drop-shadow(0 0 4px ${color}cc)`
            : isMainPath
              ? `drop-shadow(0 0 2px ${color}88)`
              : 'none',
          transition: `d 1.5s cubic-bezier(0.4, 0, 0.2, 1), stroke-opacity 0.6s ease-out ${isConnecting ? drawDelay + 0.3 : 0}s, stroke-width 1.5s`,
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
        style={{ transition: 'd 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </g>
  )
})
