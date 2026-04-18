import type { Edge, Node } from '@xyflow/react'

export type Operator = '+' | '-' | '*' | '/'

export const OPERATOR_COLORS: Record<Operator, string> = {
  '+': '#8ca291',
  '-': '#bb8f96',
  '*': '#8195a6',
  '/': '#ae9f7e',
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

export const OPERATOR_SHADOW: Record<Operator, string> = {
  '+': '0 0 16px rgba(140,162,145,0.6)',
  '-': '0 0 16px rgba(187,143,150,0.6)',
  '*': '0 0 16px rgba(129,149,166,0.6)',
  '/': '0 0 16px rgba(174,159,126,0.6)',
}

export interface FrameRegion {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export interface ParsedCell {
  address: string
  col: number
  row: number
  value: number | string | null
  rawValue: string | null
  formula: string | null
  label: string | null
  comment: string | null
  isMarked: boolean
  isPercent: boolean
  deps?: string[]
}

export interface WhatIfDelta {
  abs: number
  pct: number | null
}

export interface WhatIfScenario {
  overrides: Record<string, number>
  recomputed: Record<string, number | string | null>
  delta: Record<string, WhatIfDelta>
  unsupportedCells: string[]
}

export interface DisplaySettings {
  numberDecimals: number
  percentMode: boolean
  percentDecimals: number
  simplifyOperators: boolean
}

export interface CellNodeData extends Record<string, unknown> {
  address: string
  value: number | string | null
  formula: string | null
  label: string | null
  isInput: boolean
  isOutput: boolean
  isMarked: boolean
  isPercent: boolean
  isComplex?: boolean
  isInCycle?: boolean
  isTruncatedSum?: boolean
}

export interface OperatorNodeData extends Record<string, unknown> {
  operator: Operator
  literalOperands: Array<{
    side: 'left' | 'right'
    value: number | string
    isPercent: boolean
  }>
  sumTerms?: string[]
}

export interface BranchNodeData extends Record<string, unknown> {
  condition: string
  conditionDeps: string[]
  activeBranch: 'true' | 'false' | 'unknown'
  trueLabel: string
  falseLabel: string
  trueDeps: string[]
  falseDeps: string[]
}

export interface ConstantNodeData extends Record<string, unknown> {
  value: number
}

export type CellFlowNode = Node<CellNodeData, 'cellNode'>
export type OperatorFlowNode = Node<OperatorNodeData, 'operatorNode'>
export type BranchFlowNode = Node<BranchNodeData, 'branchNode'>
export type ConstantFlowNode = Node<ConstantNodeData, 'constantNode'>

export type FlowNode =
  | CellFlowNode
  | OperatorFlowNode
  | BranchFlowNode
  | ConstantFlowNode

export interface FlowEdgeData extends Record<string, unknown> {
  operator: Operator
  isMainPath?: boolean
  isInCycle?: boolean
  cycleId?: string
}

export type FlowEdge = Edge<FlowEdgeData>
