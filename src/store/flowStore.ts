import { create } from 'zustand'
import type { FlowNode, FlowEdge, AnimationStatus, AnimationStep, DisplaySettings } from '../types'

interface MainPathResult {
  mainPathNodeIds: Set<string>
  mainPathEdgeIds: Set<string>
}

export interface FlowStore {
  // ── File state ──────────────────────────────
  fileName: string | null
  error: string | null
  isLoading: boolean

  // ── Graph data ──────────────────────────────
  nodes: FlowNode[]
  edges: FlowEdge[]
  mainPathNodeIds: Set<string>
  mainPathEdgeIds: Set<string>

  // ── Display settings ────────────────────────
  displaySettings: DisplaySettings

  // ── Animation ───────────────────────────────
  animationStatus: AnimationStatus
  speed: number
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
  const inDegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  const edgesByTarget = new Map<string, string[]>()

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

function findMainPath(nodes: FlowNode[], edges: FlowEdge[]): MainPathResult {
  const markedCells = nodes.filter(
    (node): node is Extract<FlowNode, { type: 'cellNode' }> => node.type === 'cellNode' && !!node.data.isMarked,
  )

  if (markedCells.length < 2) {
    return { mainPathNodeIds: new Set(), mainPathEdgeIds: new Set() }
  }

  const incomingCount = new Map<string, number>()
  const outgoingCount = new Map<string, number>()
  const outgoingEdges = new Map<string, FlowEdge[]>()

  nodes.forEach(node => {
    incomingCount.set(node.id, 0)
    outgoingCount.set(node.id, 0)
    outgoingEdges.set(node.id, [])
  })

  edges.forEach(edge => {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1)
    outgoingEdges.get(edge.source)?.push(edge)
  })

  const startNode = markedCells.find(node => (incomingCount.get(node.id) ?? 0) === 0)
    ?? markedCells.find(node => !node.data.formula)
    ?? markedCells[0]

  const endNode = [...markedCells].reverse().find(node => (outgoingCount.get(node.id) ?? 0) === 0)
    ?? [...markedCells].reverse().find(node => !!node.data.formula)
    ?? markedCells[markedCells.length - 1]

  if (!startNode || !endNode || startNode.id === endNode.id) {
    return { mainPathNodeIds: new Set(), mainPathEdgeIds: new Set() }
  }

  const queue = [startNode.id]
  const visited = new Set([startNode.id])
  const prevNode = new Map<string, string>()
  const prevEdge = new Map<string, string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === endNode.id) break

    for (const edge of outgoingEdges.get(current) ?? []) {
      if (visited.has(edge.target)) continue
      visited.add(edge.target)
      prevNode.set(edge.target, current)
      prevEdge.set(edge.target, edge.id)
      queue.push(edge.target)
    }
  }

  if (!visited.has(endNode.id)) {
    return { mainPathNodeIds: new Set(), mainPathEdgeIds: new Set() }
  }

  const mainPathNodeIds = new Set<string>()
  const mainPathEdgeIds = new Set<string>()

  let cursor: string | undefined = endNode.id
  while (cursor) {
    mainPathNodeIds.add(cursor)
    const edgeId = prevEdge.get(cursor)
    if (edgeId) mainPathEdgeIds.add(edgeId)
    cursor = prevNode.get(cursor)
  }

  return { mainPathNodeIds, mainPathEdgeIds }
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  fileName: null,
  error: null,
  isLoading: false,
  nodes: [],
  edges: [],
  mainPathNodeIds: new Set(),
  mainPathEdgeIds: new Set(),
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
    const { mainPathNodeIds, mainPathEdgeIds } = findMainPath(nodes, edges)
    const animationNodes = mainPathNodeIds.size
      ? nodes.filter(node => mainPathNodeIds.has(node.id))
      : nodes
    const animationEdges = mainPathEdgeIds.size
      ? edges.filter(edge => mainPathEdgeIds.has(edge.id))
      : edges
    const animationSteps = buildAnimationSteps(animationNodes, animationEdges)

    set({
      fileName,
      nodes,
      edges,
      mainPathNodeIds,
      mainPathEdgeIds,
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
      mainPathNodeIds: new Set(),
      mainPathEdgeIds: new Set(),
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
