import type { Node, Edge } from '@xyflow/react'

// ── Operators ───────────────────────────────────
export type Operator = '+' | '-' | '*' | '/'

export const OPERATOR_COLORS: Record<Operator, string> = {
  '+': '#8ca291', // Muted sage green
  '-': '#bb8f96', // Dusty rose/mauve
  '*': '#8195a6', // Slate blue
  '/': '#ae9f7e', // Muted sand/ochre
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
  /**
   * Cell addresses this formula depends on — provided by Go backend.
   * Covers IF/VLOOKUP/MAX/etc. that the JS tokenizer cannot fully parse.
   */
  deps?: string[]
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
  isInput: boolean      // no formula → "起点"
  isOutput: boolean     // has formula + terminal → "终点"
  isMarked: boolean     // purple fill — user explicitly marked start/end
  isPercent: boolean    // Excel-formatted as %
  isComplex?: boolean   // formula uses unsupported functions (IF/VLOOKUP/etc.) — deps-based edges
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

export interface ConstantNodeData extends Record<string, unknown> {
  value: number
}

/** One step in a linear computation chain */
export interface ChainStep {
  cellId: string
  label: string
  value: number | string | null
  isPercent: boolean
  /** Operator connecting this step to the next one (null on the last step) */
  opToNext: Operator | null
  /** Literal constant used by opToNext (null if the op uses another cell ref) */
  constantToNext: number | null
  constantIsPercentToNext: boolean
}

export interface ChainNodeData extends Record<string, unknown> {
  /** All cells in the chain, from start to end (inclusive) */
  steps: ChainStep[]
  annotation: string
}

export interface ValueDuplicateNodeData extends Record<string, unknown> {
  /** The shared value */
  value: number | string | null
  isPercent: boolean
  /** IDs of all deduplicated member cellNodes */
  memberIds: string[]
  memberLabels: string[]
  /** The deepest member (closest to output) used as representative */
  representativeId: string
  annotation: string
}

export interface SumClusterNodeData extends Record<string, unknown> {
  /** IDs of the leaf input cellNodes collapsed into this cluster */
  memberIds: string[]
  memberLabels: string[]
  memberValues: (number | string | null)[]
  memberIsPercent: boolean[]
  total: number
  count: number
  min: number
  max: number
  mean: number
  annotation: string
  representativeId: string
}

export interface ArithmeticGroupNodeData extends Record<string, unknown> {
  /** Cell addresses (ids) of the grouped members */
  memberIds: string[]
  /** Display labels (label or address) for each member */
  memberLabels: string[]
  /** Current computed values for each member */
  memberValues: (number | string | null)[]
  /** Whether each member value is percent-formatted */
  memberIsPercent: boolean[]
  /** The shared arithmetic operator */
  operator: Operator
  /** The shared literal constant applied to every member */
  constant: number
  /** Whether the constant is expressed as a percentage */
  constantIsPercent: boolean
  /** Auto-generated human-readable annotation */
  annotation: string
  /** ID of the representative member used for edge routing */
  representativeId: string
}

// ── Flow graph types ────────────────────────────
export type CellFlowNode            = Node<CellNodeData, 'cellNode'>
export type OperatorFlowNode        = Node<OperatorNodeData, 'operatorNode'>
export type ConstantFlowNode        = Node<ConstantNodeData, 'constantNode'>
export type ArithmeticGroupFlowNode = Node<ArithmeticGroupNodeData, 'arithmeticGroupNode'>
export type ChainFlowNode           = Node<ChainNodeData, 'chainNode'>
export type ValueDuplicateFlowNode  = Node<ValueDuplicateNodeData, 'valueDuplicateNode'>
export type SumClusterFlowNode      = Node<SumClusterNodeData, 'sumClusterNode'>
export type FlowNode =
  | CellFlowNode
  | OperatorFlowNode
  | ConstantFlowNode
  | ArithmeticGroupFlowNode
  | ChainFlowNode
  | ValueDuplicateFlowNode
  | SumClusterFlowNode

export interface FlowEdgeData extends Record<string, unknown> {
  operator: Operator
  isMainPath?: boolean
}
export type FlowEdge = Edge<FlowEdgeData>

// ── Animation ───────────────────────────────────
export type AnimationStatus = 'idle' | 'playing' | 'paused' | 'done'

export interface AnimationStep {
  nodeIds: string[]
  edgeIds: string[]
}
