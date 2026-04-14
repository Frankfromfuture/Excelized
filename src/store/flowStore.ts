import { create } from 'zustand'
import type { FlowNode, FlowEdge, AnimationStatus, AnimationStep, DisplaySettings } from '../types'

interface FlowStore {
  // ── File state ──────────────────────────────
  fileName: string | null
  error: string | null
  isLoading: boolean

  // ── Graph data ──────────────────────────────
  nodes: FlowNode[]
  edges: FlowEdge[]

  // ── Display settings ────────────────────────
  displaySettings: DisplaySettings

  // ── Animation ───────────────────────────────
  animationStatus: AnimationStatus
  speed: number                    // 0.5 | 1 | 1.5 | 2
  activeNodeIds: Set<string>
  activeEdgeIds: Set<string>
  animationStep: number
  animationSteps: AnimationStep[]
  animationTimer: ReturnType<typeof setTimeout> | null

  // ── Actions ─────────────────────────────────
  setLoading: (v: boolean) => void
  setError: (msg: string | null) => void
  setFlowData: (fileName: string, nodes: FlowNode[], edges: FlowEdge[]) => void
  resetFlow: () => void
  setDisplaySettings: (patch: Partial<DisplaySettings>) => void

  playAnimation: () => void
  pauseAnimation: () => void
  resetAnimation: () => void
  setSpeed: (speed: number) => void
  _tick: () => void
}

function buildAnimationSteps(nodes: FlowNode[], edges: FlowEdge[]): AnimationStep[] {
  // Kahn's topological sort → levels for BFS-style animation
  const inDegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  const edgesByTarget = new Map<string, string[]>()  // targetId → edgeIds

  nodes.forEach(n => { inDegree.set(n.id, 0); outgoing.set(n.id, []) })

  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    outgoing.get(e.source)?.push(e.target)
    if (!edgesByTarget.has(e.target)) edgesByTarget.set(e.target, [])
    edgesByTarget.get(e.target)!.push(e.id)
  })

  const steps: AnimationStep[] = []
  let queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id)

  while (queue.length > 0) {
    // Collect edges that lead TO nodes in the next level (they activate WITH the node)
    const edgeIds: string[] = []
    queue.forEach(id => {
      edgesByTarget.get(id)?.forEach(eid => edgeIds.push(eid))
    })
    steps.push({ nodeIds: [...queue], edgeIds })

    const next: string[] = []
    queue.forEach(id => {
      outgoing.get(id)?.forEach(neighbor => {
        const deg = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, deg)
        if (deg === 0) next.push(neighbor)
      })
    })
    queue = next
  }

  return steps
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  fileName: null,
  error: null,
  isLoading: false,
  nodes: [],
  edges: [],
  displaySettings: { numberDecimals: 0, percentMode: true, percentDecimals: 2 },
  animationStatus: 'idle',
  speed: 1,
  activeNodeIds: new Set(),
  activeEdgeIds: new Set(),
  animationStep: 0,
  animationSteps: [],
  animationTimer: null,

  setLoading: (v) => set({ isLoading: v }),
  setError: (msg) => set({ error: msg, isLoading: false }),
  setDisplaySettings: (patch) =>
    set(s => ({ displaySettings: { ...s.displaySettings, ...patch } })),

  setFlowData: (fileName, nodes, edges) => {
    const animationSteps = buildAnimationSteps(nodes, edges)
    set({
      fileName,
      nodes,
      edges,
      animationSteps,
      animationStatus: 'idle',
      activeNodeIds: new Set(),
      activeEdgeIds: new Set(),
      animationStep: 0,
      error: null,
      isLoading: false,
    })
  },

  resetFlow: () =>
    set({
      fileName: null,
      error: null,
      nodes: [],
      edges: [],
      animationSteps: [],
      animationStatus: 'idle',
      activeNodeIds: new Set(),
      activeEdgeIds: new Set(),
      animationStep: 0,
    }),

  playAnimation: () => {
    const { animationStatus, animationSteps, speed, _tick } = get()
    if (animationSteps.length === 0) return
    if (animationStatus === 'done') {
      // Restart
      set({ activeNodeIds: new Set(), activeEdgeIds: new Set(), animationStep: 0 })
    }
    set({ animationStatus: 'playing' })
    const delay = 900 / speed
    const timer = setTimeout(_tick, delay)
    set({ animationTimer: timer })
  },

  pauseAnimation: () => {
    const { animationTimer } = get()
    if (animationTimer) clearTimeout(animationTimer)
    set({ animationStatus: 'paused', animationTimer: null })
  },

  resetAnimation: () => {
    const { animationTimer } = get()
    if (animationTimer) clearTimeout(animationTimer)
    set({
      animationStatus: 'idle',
      activeNodeIds: new Set(),
      activeEdgeIds: new Set(),
      animationStep: 0,
      animationTimer: null,
    })
  },

  setSpeed: (speed) => set({ speed }),

  _tick: () => {
    const { animationStep, animationSteps, speed, activeNodeIds, activeEdgeIds } = get()
    if (animationStep >= animationSteps.length) {
      set({ animationStatus: 'done', animationTimer: null })
      return
    }
    const step = animationSteps[animationStep]
    const newNodes = new Set([...activeNodeIds, ...step.nodeIds])
    const newEdges = new Set([...activeEdgeIds, ...step.edgeIds])
    set({ activeNodeIds: newNodes, activeEdgeIds: newEdges, animationStep: animationStep + 1 })

    if (animationStep + 1 < animationSteps.length) {
      const delay = 900 / speed
      const timer = setTimeout(get()._tick, delay)
      set({ animationTimer: timer })
    } else {
      set({ animationStatus: 'done', animationTimer: null })
    }
  },
}))
