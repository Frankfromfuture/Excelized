import { describe, expect, it } from 'vitest'
import { buildFlowGraph } from './buildGraph'
import type { ParsedCell } from '../../types'

function baseCell(cell: Partial<ParsedCell> & Pick<ParsedCell, 'address'>): ParsedCell {
  return {
    col: 0,
    row: 0,
    value: null,
    rawValue: null,
    formula: null,
    label: null,
    comment: null,
    isMarked: false,
    isPercent: false,
    ...cell,
  }
}

describe('buildFlowGraph', () => {
  it('annotates cycle members', () => {
    const cells: ParsedCell[] = [
      baseCell({ address: 'A1', value: 2, formula: '=B1+1' }),
      baseCell({ address: 'B1', value: 3, formula: '=A1+1' }),
    ]

    const { nodes, edges } = buildFlowGraph(cells)
    const cycleNodes = nodes.filter(node => node.type === 'cellNode' && node.data.isInCycle)
    const cycleEdges = edges.filter(edge => edge.data?.isInCycle)

    expect(cycleNodes.map(node => node.id).sort()).toEqual(['A1', 'B1'])
    expect(cycleEdges.length).toBeGreaterThan(0)
  })

  it('marks oversized SUM formulas as truncated and limits graph growth', () => {
    const inputCells: ParsedCell[] = Array.from({ length: 260 }, (_, index) =>
      baseCell({
        address: `A${index + 1}`,
        row: index,
        value: index + 1,
      }),
    )
    const totalCell = baseCell({
      address: 'B1',
      col: 1,
      row: 0,
      value: 33830,
      formula: '=SUM(A1:A260)',
      isMarked: true,
    })

    const { nodes, edges } = buildFlowGraph([...inputCells, totalCell])
    const targetNode = nodes.find(node => node.id === 'B1' && node.type === 'cellNode')

    expect(targetNode?.type).toBe('cellNode')
    expect(targetNode && targetNode.type === 'cellNode' ? targetNode.data.isTruncatedSum : false).toBe(true)
    expect(nodes.length).toBeLessThan(500)
    expect(edges.length).toBeLessThan(500)
  })

  it('creates a branch node for simple IF formulas', () => {
    const cells: ParsedCell[] = [
      baseCell({ address: 'A1', value: 120 }),
      baseCell({ address: 'B1', value: 12, formula: '=IF(A1>100,A1*0.1,A1*0.05)' }),
    ]

    const { nodes, edges } = buildFlowGraph(cells)
    const branchNode = nodes.find(node => node.type === 'branchNode')

    expect(branchNode?.type).toBe('branchNode')
    expect(branchNode && branchNode.type === 'branchNode' ? branchNode.data.activeBranch : 'unknown').toBe('true')
    expect(edges.some(edge => edge.target === branchNode?.id)).toBe(true)
  })
})
