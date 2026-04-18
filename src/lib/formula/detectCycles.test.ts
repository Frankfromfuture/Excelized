import { describe, expect, it } from 'vitest'
import { detectCycles } from './detectCycles'
import type { FlowEdge } from '../../types'

describe('detectCycles', () => {
  it('finds a simple cycle', () => {
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'A', target: 'B', data: { operator: '+' } } as FlowEdge,
      { id: 'e2', source: 'B', target: 'C', data: { operator: '+' } } as FlowEdge,
      { id: 'e3', source: 'C', target: 'A', data: { operator: '+' } } as FlowEdge,
    ]

    const cycles = detectCycles(edges)

    expect(cycles).toHaveLength(1)
    expect(new Set(cycles[0])).toEqual(new Set(['A', 'B', 'C']))
  })

  it('ignores acyclic graphs', () => {
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'A', target: 'B', data: { operator: '+' } } as FlowEdge,
      { id: 'e2', source: 'B', target: 'C', data: { operator: '+' } } as FlowEdge,
    ]

    expect(detectCycles(edges)).toEqual([])
  })
})
