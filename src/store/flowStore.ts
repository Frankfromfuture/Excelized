import { create } from 'zustand'
import type { FlowNode, FlowEdge, AnimationStatus, AnimationStep, DisplaySettings } from '../types'
import { applyDagreLayout } from '../lib/layout/autoLayout'
import { computeSensitivities } from '../lib/formula/sensitivity'

export type IntroState = 'idle' | 'unfocused' | 'moving_cards' | 'connecting_edges' | 'done'
export type GlobalLevel = 1 | 2 | 3

/**
 * Compute the three-level node-id sets for the global view selector.
 *
 * Level 1 — 核心路径: Shortest direct path from start node to end node
 *            (single BFS shortest-path chain, minimal hops)
 * Level 2 — 扩展关联: First 50% of mainPath nodes sorted by topological depth
 * Level 3 — 全局视图: All mainPath ancestor nodes (complete computation)
 */
function computeLevelNodeIds(
  allNodes: FlowNode[],
  allEdges: FlowEdge[],
  mainPathNodeIds: Set<string>,
): Record<GlobalLevel, Set<string>> {
  // Work only within the main-path subgraph
  const mainNodes = allNodes.filter(n => mainPathNodeIds.has(n.id))
  const mainEdges = allEdges.filter(e => mainPathNodeIds.has(e.source) && mainPathNodeIds.has(e.target))

  const hasIncoming = new Set(mainEdges.map(e => e.target))
  const hasOutgoing = new Set(mainEdges.map(e => e.source))

  // Identify start (no incoming) and end (no outgoing) within mainPath
  const startId = mainNodes.find(n => !hasIncoming.has(n.id))?.id
  const endId   = mainNodes.find(n => !hasOutgoing.has(n.id))?.id

  // ── Level 1: BFS shortest path from start → end ──────────────────────────
  let level1 = new Set<string>()
  if (startId && endId) {
    const outMap = new Map<string, string[]>()
    mainEdges.forEach(e => {
      if (!outMap.has(e.source)) outMap.set(e.source, [])
      outMap.get(e.source)!.push(e.target)
    })
    const parent = new Map<string, string | null>([[startId, null]])
    const bfsQ = [startId]
    let bi = 0, found = false
    while (bi < bfsQ.length && !found) {
      const cur = bfsQ[bi++]
      for (const next of outMap.get(cur) ?? []) {
        if (!parent.has(next)) {
          parent.set(next, cur)
          if (next === endId) { found = true; break }
          bfsQ.push(next)
        }
      }
    }
    if (found) {
      let cur: string | null | undefined = endId
      while (cur != null) { level1.add(cur); cur = parent.get(cur) }
    }
  }
  if (level1.size === 0) level1 = new Set(mainPathNodeIds) // fallback

  // ── Level 2: 50% of mainPath by topological depth ─────────────────────────
  const depthMap = new Map<string, number>()
  const outMap2 = new Map<string, string[]>()
  mainEdges.forEach(e => {
    if (!outMap2.has(e.source)) outMap2.set(e.source, [])
    outMap2.get(e.source)!.push(e.target)
  })
  const roots = mainNodes.filter(n => !hasIncoming.has(n.id)).map(n => n.id)
  const topoQ = [...roots]
  roots.forEach(id => depthMap.set(id, 0))
  let ti = 0
  while (ti < topoQ.length) {
    const cur = topoQ[ti++]
    for (const next of outMap2.get(cur) ?? []) {
      if (!depthMap.has(next)) {
        depthMap.set(next, (depthMap.get(cur) ?? 0) + 1)
        topoQ.push(next)
      }
    }
  }
  const sortedMain = [...mainPathNodeIds].sort((a, b) => (depthMap.get(a) ?? 0) - (depthMap.get(b) ?? 0))
  const half = Math.ceil(sortedMain.length * 0.5)
  const level2 = new Set(sortedMain.slice(0, half))

  // ── Level 3: All mainPath nodes ────────────────────────────────────────────
  const level3 = new Set(mainPathNodeIds)

  return { 1: level1, 2: level2, 3: level3 }
}

interface MainPathResult {
  mainPathNodeIds: Set<string>
  mainPathEdgeIds: Set<string>
}

/**
 * Collect ALL ancestors of endId (backward BFS) — every node that
 * directly or transitively contributes to the final result is included.
 * The start cell is used only as a visual badge; it does not restrict which
 * nodes are highlighted.
 */
function collectAllAncestors(endId: string, edges: FlowEdge[]): MainPathResult {
  const incomingEdges = new Map<string, FlowEdge[]>()
  edges.forEach(edge => {
    if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, [])
    incomingEdges.get(edge.target)!.push(edge)
  })

  // Backward BFS: start from end, walk every incoming edge
  const visited = new Set<string>([endId])
  const queue = [endId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of incomingEdges.get(current) ?? []) {
      if (visited.has(edge.source)) continue
      visited.add(edge.source)
      queue.push(edge.source)
    }
  }

  // Every edge whose both endpoints are in the ancestor set belongs to the path
  const mainPathEdgeIds = new Set<string>()
  edges.forEach(edge => {
    if (visited.has(edge.source) && visited.has(edge.target)) {
      mainPathEdgeIds.add(edge.id)
    }
  })

  return { mainPathNodeIds: visited, mainPathEdgeIds }
}

export interface FlowStore {
  // ── File state ──────────────────────────────
  fileName: string | null
  error: string | null
  isLoading: boolean
  startCellInput: string
  endCellInput: string

  // ── Graph data ──────────────────────────────
  nodes: FlowNode[]
  edges: FlowEdge[]
  hasMainPath: boolean
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

  // ── Focus mode ──────────────────────────────
  focusMainPath: boolean
  savedNodes: FlowNode[] | null
  sensitivityMap: Record<string, number> | null
  globalLevel: GlobalLevel
  levelNodeIds: Record<GlobalLevel, Set<string>>

  // ── Actions ─────────────────────────────────
  setLoading: (v: boolean) => void
  setIntroState: (state: IntroState) => void
  setError: (msg: string | null) => void
  setStartCellInput: (value: string) => void
  setEndCellInput: (value: string) => void
  setFlowData: (fileName: string, nodes: FlowNode[], edges: FlowEdge[]) => void
  resetFlow: () => void
  setDisplaySettings: (patch: Partial<DisplaySettings>) => void

  relayoutFlow: () => void
  toggleFocusMainPath: () => void
  setGlobalLevel: (level: GlobalLevel) => void

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

function findMainPath(
  nodes: FlowNode[],
  edges: FlowEdge[],
  endCellInput?: string,
): MainPathResult {
  const normalizedEnd = endCellInput?.trim().toUpperCase()
  const cellNodes = nodes.filter(
    (node): node is Extract<FlowNode, { type: 'cellNode' }> => node.type === 'cellNode',
  )

  if (cellNodes.length === 0) return { mainPathNodeIds: new Set(), mainPathEdgeIds: new Set() }

  // Resolve end node: explicit input → marked output cell → any output cell
  const endNode =
    (normalizedEnd ? cellNodes.find(n => n.id.toUpperCase() === normalizedEnd) : undefined) ??
    cellNodes.find(n => n.data.isMarked && n.data.isOutput) ??
    cellNodes.find(n => n.data.isOutput)

  if (!endNode) return { mainPathNodeIds: new Set(), mainPathEdgeIds: new Set() }

  // Main path = every node that feeds into the end result (full ancestor tree)
  return collectAllAncestors(endNode.id, edges)
}



// ── Store definition ───────────────────────────────────────────────────────

export const useFlowStore = create<FlowStore>((set, get) => ({
  fileName: null,
  error: null,
  isLoading: false,
  startCellInput: '',
  endCellInput: '',
  nodes: [],
  edges: [],
  hasMainPath: false,
  mainPathNodeIds: new Set(),
  mainPathEdgeIds: new Set(),
  focusMainPath: false,
  savedNodes: null,
  sensitivityMap: null,
  globalLevel: 1,
  levelNodeIds: { 1: new Set(), 2: new Set(), 3: new Set() },
  introState: 'idle',
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
  setStartCellInput: (value) => set({ startCellInput: value }),
  setEndCellInput: (value) => set({ endCellInput: value }),
  setDisplaySettings: (patch) =>
    set(s => ({ displaySettings: { ...s.displaySettings, ...patch } })),

  setFlowData: (fileName, nodes, edges) => {
    const { endCellInput } = get()
    const { mainPathNodeIds, mainPathEdgeIds } = findMainPath(nodes, edges, endCellInput)
    const hasMainPath = mainPathNodeIds.size > 0 && mainPathEdgeIds.size > 0

    const animationNodes = hasMainPath
      ? nodes.filter(node => mainPathNodeIds.has(node.id))
      : nodes
    const animationEdges = hasMainPath
      ? edges.filter(edge => mainPathEdgeIds.has(edge.id))
      : edges
    const animationSteps = buildAnimationSteps(animationNodes, animationEdges)

    set({
      fileName,
      nodes,
      edges,
      hasMainPath,
      mainPathNodeIds,
      mainPathEdgeIds,
      focusMainPath: false,
      savedNodes: null,
      sensitivityMap: null,
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
      startCellInput: '',
      endCellInput: '',
      hasMainPath: false,
      mainPathNodeIds: new Set(),
      mainPathEdgeIds: new Set(),
      focusMainPath: false,
      savedNodes: null,
      sensitivityMap: null,
      animationSteps: [],
      animationStatus: 'idle',
      activeNodeIds: new Set(),
      activeEdgeIds: new Set(),
      animationStep: 0,
    }),

  setIntroState: (state) => set({ introState: state }),

  setGlobalLevel: (level) => {
    const { nodes, edges, levelNodeIds, focusMainPath } = get()
    if (!focusMainPath) { set({ globalLevel: level }); return }

    const visibleIds = levelNodeIds[level]
    const visibleNodes = nodes.filter(n => visibleIds.has(n.id))
    const visibleEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))

    // Re-run Dagre on just the visible subset for a compact, readable layout
    const relaid = applyDagreLayout(visibleNodes, visibleEdges)

    // Merge positions back: update visible nodes, keep hidden nodes in place
    const posMap = new Map(relaid.map(n => [n.id, n.position]))
    const updatedNodes = nodes.map(n =>
      posMap.has(n.id) ? { ...n, position: posMap.get(n.id)! } : n,
    )

    set({ globalLevel: level, nodes: updatedNodes })
  },


  relayoutFlow: () => {
    const { nodes, edges, savedNodes, focusMainPath } = get()
    // If in focus mode, relayout the original graph (exits focus mode)
    const source = (focusMainPath && savedNodes) ? savedNodes : nodes
    if (source.length === 0) return
    const laid = applyDagreLayout(source, edges)
    set({ nodes: laid, focusMainPath: false, savedNodes: null, sensitivityMap: null })
  },

  toggleFocusMainPath: () => {
    const { focusMainPath, hasMainPath, nodes, edges, mainPathNodeIds, mainPathEdgeIds, savedNodes } = get()
    if (!hasMainPath) return

    if (!focusMainPath) {
      // ── Entering focus mode ──────────────────────────────────────────────
      const mainNodes = nodes.filter(n => mainPathNodeIds.has(n.id))
      const mainEdges = edges.filter(e => mainPathEdgeIds.has(e.id))

      // Dagre layout on main path subgraph only
      const laidMain = applyDagreLayout(mainNodes, mainEdges)

      let finalMain = laidMain
      if (mainNodes.length > 0) {
        const origMinX = Math.min(...mainNodes.map(n => n.position.x))
        // Try to anchor vertically by the first input node to keep it visually stable, or fallback to minY
        const startNode = mainNodes.find(n => n.type === 'cellNode' && (n.data.isMarked || n.data.isInput)) ?? mainNodes[0]
        const origY = nodes.find(n => n.id === startNode.id)?.position.y ?? Math.min(...mainNodes.map(n => n.position.y))
        
        const laidMinX = Math.min(...laidMain.map(n => n.position.x))
        const laidY = laidMain.find(n => n.id === startNode.id)?.position.y ?? Math.min(...laidMain.map(n => n.position.y))

        const dx = origMinX - laidMinX
        const dy = origY - laidY

        finalMain = laidMain.map(n => ({
          ...n,
          position: { x: n.position.x + dx, y: n.position.y + dy },
        }))
      }

      const nonMain = nodes.filter(n => !mainPathNodeIds.has(n.id))
      const sensitivityMap = computeSensitivities(mainNodes, mainEdges)
      const levelNodeIds = computeLevelNodeIds(nodes, edges, mainPathNodeIds)

      set({
        nodes: [...finalMain, ...nonMain],
        savedNodes: nodes,
        focusMainPath: true,
        sensitivityMap,
        globalLevel: 1,
        levelNodeIds,
      })
    } else {
      // ── Exiting focus mode ───────────────────────────────────────────────
      set({ nodes: savedNodes ?? nodes, savedNodes: null, focusMainPath: false, sensitivityMap: null, globalLevel: 1 })
    }
  },

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
