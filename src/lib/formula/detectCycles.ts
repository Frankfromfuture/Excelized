import type { FlowEdge } from '../../types'

export function detectCycles(edges: FlowEdge[]): string[][] {
  const nodeIds = new Set<string>()
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    nodeIds.add(edge.source)
    nodeIds.add(edge.target)
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    adjacency.get(edge.source)!.push(edge.target)
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
  }

  const indexMap = new Map<string, number>()
  const lowLink = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const cycles: string[][] = []
  let index = 0

  function strongConnect(nodeId: string) {
    indexMap.set(nodeId, index)
    lowLink.set(nodeId, index)
    index += 1
    stack.push(nodeId)
    onStack.add(nodeId)

    for (const nextId of adjacency.get(nodeId) ?? []) {
      if (!indexMap.has(nextId)) {
        strongConnect(nextId)
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, lowLink.get(nextId)!))
      } else if (onStack.has(nextId)) {
        lowLink.set(nodeId, Math.min(lowLink.get(nodeId)!, indexMap.get(nextId)!))
      }
    }

    if (lowLink.get(nodeId) !== indexMap.get(nodeId)) return

    const component: string[] = []
    while (stack.length > 0) {
      const memberId = stack.pop()!
      onStack.delete(memberId)
      component.push(memberId)
      if (memberId === nodeId) break
    }

    if (component.length > 1) {
      cycles.push(component)
      return
    }

    const [single] = component
    if ((adjacency.get(single) ?? []).includes(single)) {
      cycles.push(component)
    }
  }

  for (const nodeId of nodeIds) {
    if (!indexMap.has(nodeId)) strongConnect(nodeId)
  }

  return cycles
}
