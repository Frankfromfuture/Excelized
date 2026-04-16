import type { FlowNode, FlowEdge } from '../../types'

export type SensitivityMap = Record<string, number>

export function computeSensitivities(
  nodes: FlowNode[],
  edges: FlowEdge[]
): SensitivityMap {
  const scores = new Map<string, number>()
  if (nodes.length === 0) return {}

  // 1. Build reverse graph structures
  const outDegree = new Map<string, number>()
  const incoming = new Map<string, FlowEdge[]>()
  
  nodes.forEach(n => {
    outDegree.set(n.id, 0)
    incoming.set(n.id, [])
  })

  edges.forEach(e => {
    outDegree.set(e.source, (outDegree.get(e.source) || 0) + 1)
    if (!incoming.has(e.target)) incoming.set(e.target, [])
    incoming.get(e.target)!.push(e)
  })

  // 2. Queue nodes with no outgoing edges (End results)
  const queue: string[] = []
  nodes.forEach(n => {
    if (outDegree.get(n.id) === 0) {
      queue.push(n.id)
      scores.set(n.id, 1.0) // End result starts with 1.0 sensitivity (elasticity base)
    }
  })

  // Helper to extract numeric value from a node
  const getNodeValue = (id: string): number => {
    const n = nodes.find(x => x.id === id)
    if (n?.type === 'cellNode') return Number(n.data.value) || 0
    if (n?.type === 'constantNode') return Number(n.data.value) || 0
    return 0
  }

  // 3. Backpropagate
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentNode = nodes.find(n => n.id === currentId)
    const currentScore = scores.get(currentId) || 0

    if (!currentNode) continue

    if (currentNode.type === 'cellNode' || currentNode.type === 'constantNode') {
      // Cell nodes pass their score completely to their generating operator
      const inEdges = incoming.get(currentId) || []
      for (const e of inEdges) {
        // If complex formula (cell -> cell), pass score. If operator, pass score.
        const srcScore = scores.get(e.source) || 0
        scores.set(e.source, srcScore + currentScore)
        
        const deg = (outDegree.get(e.source) || 1) - 1
        outDegree.set(e.source, deg)
        if (deg === 0) queue.push(e.source)
      }
    } 
    else if (currentNode.type === 'operatorNode') {
      const opData = currentNode.data as any
      const op = opData.operator
      const inEdges = incoming.get(currentId) || []
      const literals = opData.literalOperands || []

      // To calculate elasticity proportions, we need all operands
      // For +/-, elasticity is |V_i| / sum(|V_i|)
      // For */, elasticity is 1.0 for each operand
      
      const operandValues: { id: string, val: number, isLiteral: boolean }[] = []
      
      inEdges.forEach(e => {
        operandValues.push({ id: e.source, val: getNodeValue(e.source), isLiteral: false })
      })
      literals.forEach((lit: any, i: number) => {
        const id = `${currentId}_literal_${lit.side}`
        operandValues.push({ id, val: Number(lit.value) || 0, isLiteral: true })
      })

      if (op === '*' || op === '/') {
        // Elasticity holds: proportional multiplicative change is 1-to-1
        operandValues.forEach(opnd => {
          const inherited = currentScore * 1.0
          scores.set(opnd.id, (scores.get(opnd.id) || 0) + inherited)
        })
      } else {
        // '+' or '-'
        let sumAbs = 0
        operandValues.forEach(opnd => { sumAbs += Math.abs(opnd.val) })
        
        operandValues.forEach(opnd => {
          const weight = sumAbs === 0 ? (1 / operandValues.length) : (Math.abs(opnd.val) / sumAbs)
          const inherited = currentScore * weight
          scores.set(opnd.id, (scores.get(opnd.id) || 0) + inherited)
        })
      }

      // Decrement outDegrees for graph edges
      inEdges.forEach(e => {
        const deg = (outDegree.get(e.source) || 1) - 1
        outDegree.set(e.source, deg)
        if (deg === 0) queue.push(e.source)
      })
    }
  }

  // 4. Normalize to [0, 1] range for visual rendering
  let maxScore = 0
  scores.forEach(val => {
    if (val > maxScore) maxScore = val
  })

  const normalized: SensitivityMap = {}
  scores.forEach((val, key) => {
    normalized[key] = maxScore > 0 ? (val / maxScore) : 0
  })

  return normalized
}
