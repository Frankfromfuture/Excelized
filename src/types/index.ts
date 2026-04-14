import type { Node, Edge } from '@xyflow/react'

// ── Operators ───────────────────────────────────
export type Operator = '+' | '-' | '*' | '/'

export const OPERATOR_COLORS: Record<Operator, string> = {
  '+': '#22c55e',
  '-': '#ef4444',
  '*': '#3b82f6',
  '/': '#f97316',
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
}

export const OPERATOR_SHADOW: Record<Operator, string> = {
  '+': '0 0 16px rgba(34,197,94,0.5)',
  '-': '0 0 16px rgba(239,68,68,0.5)',
  '*': '0 0 16px rgba(59,130,246,0.5)',
  '/': '0 0 16px rgba(249,115,22,0.5)',
}

// ── Excel frame ─────────────────────────────────
export interface FrameRegion {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export interface ParsedCell {
  address: string
  col: number     // 0-indexed
  row: number     // 0-indexed
  value: number | string | null
  rawValue: string | null
  formula: string | null
  label: string | null
  comment: string | null
  /** Cell has a purple fill — user-marked as start or end point */
  isMarked: boolean
  /** Cell is Excel-formatted as percentage (rawValue ends with %) */
  isPercent: boolean
}

// ── Display settings ────────────────────────────
export interface DisplaySettings {
  /** Decimal places for regular numeric values (0-3) */
  numberDecimals: number
  /** Show 0-1 range values as percentage */
  percentMode: boolean
  /** Decimal places for percentage values (0-3) */
  percentDecimals: number
}

// ── Node data ───────────────────────────────────
export interface CellNodeData extends Record<string, unknown> {
  address: string
  value: number | string | null
  formula: string | null
  label: string | null
  isInput: boolean    // no formula → "起点"
  isOutput: boolean   // has formula + terminal → "终点"
  isMarked: boolean   // purple fill — user explicitly marked start/end
  isPercent: boolean  // Excel-formatted as %
}

export interface OperatorNodeData extends Record<string, unknown> {
  operator: Operator
  constantLabels: string[]  // e.g. ["×2"] for literal numbers
}

export interface ConstantNodeData extends Record<string, unknown> {
  value: number
}

// ── Flow graph types ────────────────────────────
export type CellFlowNode     = Node<CellNodeData, 'cellNode'>
export type OperatorFlowNode = Node<OperatorNodeData, 'operatorNode'>
export type ConstantFlowNode = Node<ConstantNodeData, 'constantNode'>
export type FlowNode         = CellFlowNode | OperatorFlowNode | ConstantFlowNode

export interface FlowEdgeData extends Record<string, unknown> {
  operator: Operator
}
export type FlowEdge = Edge<FlowEdgeData>

// ── Animation ───────────────────────────────────
export type AnimationStatus = 'idle' | 'playing' | 'paused' | 'done'

export interface AnimationStep {
  nodeIds: string[]
  edgeIds: string[]
}
