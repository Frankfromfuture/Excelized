import Dagre from '@dagrejs/dagre'
import type { FlowEdge, FlowNode } from '../../types'

interface NodeDims {
  width: number
  height: number
}

function getNodeDims(node: FlowNode): NodeDims {
  switch (node.type) {
    case 'operatorNode':
      return { width: 72, height: 52 }
    case 'branchNode':
      return { width: 200, height: 132 }
    default:
      return { width: 196, height: 96 }
  }
}

export function applyDagreLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const graph = new Dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 56,
    ranksep: 88,
    marginx: 48,
    marginy: 40,
  })

  nodes.forEach((node) => {
    const { width, height } = getNodeDims(node)
    graph.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target)
  })

  Dagre.layout(graph)

  return nodes.map((node) => {
    const { x, y, width, height } = graph.node(node.id)
    return {
      ...node,
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
    }
  })
}
