import type { FlowNode, FlowEdge, ParsedCell, Operator, OperatorNodeData, ArithmeticGroupNodeData, ChainNodeData, ChainStep, ValueDuplicateNodeData, SumClusterNodeData } from '../../types'
import { tokenize } from './tokenize'
import type { Token } from './tokenize'

// ── Expression tree types ───────────────────────────────────────────────────

type ExprNode =
  | { kind: 'cell'; value: string }
  | { kind: 'number'; value: number; isPercent?: boolean }
  | { kind: 'binop'; op: Operator; left: ExprNode; right: ExprNode; fromSum?: boolean }
  | { kind: 'unknown' }

// ── Formula helpers ─────────────────────────────────────────────────────────

function colLetterToIdx(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function colIdxToLetter(idx: number): string {
  let s = ''
  let n = idx + 1
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

function normalizeAddress(address: string) {
  return address.replace(/\$/g, '').toUpperCase()
}

function expandRangeRefs(rangeRef: string, availableAddresses: Set<string>): string[] {
  const [startRaw, endRaw] = rangeRef.split(':').map(normalizeAddress)
  const start = startRaw.match(/^([A-Z]+)(\d+)$/)
  const end = endRaw.match(/^([A-Z]+)(\d+)$/)
  if (!start || !end) return []

  const startCol = colLetterToIdx(start[1])
  const endCol = colLetterToIdx(end[1])
  const startRow = parseInt(start[2], 10)
  const endRow = parseInt(end[2], 10)

  const refs: string[] = []
  for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
    for (let col = Math.min(startCol, endCol); col <= Math.max(startCol, endCol); col++) {
      const address = `${colIdxToLetter(col)}${row}`
      if (availableAddresses.has(address)) refs.push(address)
    }
  }
  return refs
}

function splitFunctionArgs(content: string): string[] {
  const args: string[] = []
  let depth = 0
  let current = ''

  for (const ch of content) {
    if (ch === '(') depth++
    if (ch === ')') depth--

    if ((ch === ',' || ch === ';') && depth === 0) {
      if (current.trim()) args.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  if (current.trim()) args.push(current.trim())
  return args
}

function buildSumExprFromRefs(refs: string[]): ExprNode {
  if (refs.length === 0) return { kind: 'number', value: 0 }
  if (refs.length === 1) return { kind: 'cell', value: refs[0] }

  const [first, second, ...rest] = refs
  let expr: ExprNode = {
    kind: 'binop',
    op: '+',
    left: { kind: 'cell', value: first },
    right: { kind: 'cell', value: second },
    fromSum: true,
  }

  for (const ref of rest) {
    expr = {
      kind: 'binop',
      op: '+',
      left: expr,
      right: { kind: 'cell', value: ref },
      fromSum: true,
    }
  }

  return expr
}

function parseSumFormulaToExpr(formula: string, availableAddresses: Set<string>): ExprNode | null {
  const src = formula.startsWith('=') ? formula.slice(1).trim() : formula.trim()
  const match = src.match(/^SUM\((.*)\)$/i)
  if (!match) return null

  const refs = splitFunctionArgs(match[1]).flatMap(arg => {
    const normalized = normalizeAddress(arg)
    if (/^(?:\[[^\]]+\])?(?:'[^']+'|[^'!]+)!/.test(arg)) return []
    if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(normalized)) return expandRangeRefs(normalized, availableAddresses)
    if (/^[A-Z]+\d+$/.test(normalized)) return [normalized]
    return []
  })

  return buildSumExprFromRefs(refs)
}

function expandSumArguments(content: string, availableAddresses: Set<string>): string {
  const pieces = splitFunctionArgs(content).flatMap(arg => {
    const normalized = normalizeAddress(arg)

    if (/^(?:\[[^\]]+\])?(?:'[^']+'|[^'!]+)!/.test(arg)) return [arg]
    if (/^[A-Z]+\d+:[A-Z]+\d+$/.test(normalized)) return expandRangeRefs(normalized, availableAddresses)
    if (/^[A-Z]+\d+$/.test(normalized)) return [normalized]
    return [arg]
  })

  if (pieces.length === 0) return '0'
  return `(${pieces.join('+')})`
}

function expandSumFormula(formula: string, availableAddresses: Set<string>): string {
  let result = formula

  while (true) {
    const upper = result.toUpperCase()
    const sumIndex = upper.indexOf('SUM(')
    if (sumIndex === -1) break

    let depth = 0
    let endIndex = -1
    for (let i = sumIndex + 3; i < result.length; i++) {
      const ch = result[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) {
          endIndex = i
          break
        }
      }
    }

    if (endIndex === -1) break

    const argsContent = result.slice(sumIndex + 4, endIndex)
    const expanded = expandSumArguments(argsContent, availableAddresses)
    result = `${result.slice(0, sumIndex)}${expanded}${result.slice(endIndex + 1)}`
  }

  return result
}

// ── Recursive-descent parser with precedence ────────────────────────────────

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => t.type !== 'UNKNOWN' && t.type !== 'EXTERNAL_REF')
  }

  private peek(): Token | null { return this.tokens[this.pos] ?? null }
  private consume(): Token { return this.tokens[this.pos++] }

  parse(): ExprNode {
    return this.parseExpr()
  }

  private parseExpr(): ExprNode {
    let left = this.parseTerm()
    while (this.peek()?.type === 'OPERATOR' && '+-'.includes(this.peek()!.value)) {
      const op = this.consume().value as Operator
      const right = this.parseTerm()
      left = { kind: 'binop', op, left, right }
    }
    return left
  }

  private parseTerm(): ExprNode {
    let left = this.parseUnary()
    while (this.peek()?.type === 'OPERATOR' && '*/'.includes(this.peek()!.value)) {
      const op = this.consume().value as Operator
      const right = this.parseUnary()
      left = { kind: 'binop', op, left, right }
    }
    return left
  }

  private parseUnary(): ExprNode {
    if (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '-') {
      this.consume()
      const f = this.parseFactor()
      if (f.kind === 'number') return { kind: 'number', value: -f.value, isPercent: f.isPercent }
      return { kind: 'binop', op: '*', left: { kind: 'number', value: -1 }, right: f }
    }
    return this.parseFactor()
  }

  private parseFactor(): ExprNode {
    const t = this.peek()
    if (!t) return { kind: 'unknown' }
    if (t.type === 'CELL_REF') { this.consume(); return { kind: 'cell', value: t.value } }
    if (t.type === 'NUMBER') {
      this.consume();
      const isPercent = t.value.endsWith('%');
      const val = parseFloat(t.value) / (isPercent ? 100 : 1);
      return { kind: 'number', value: val, isPercent }
    }
    if (t.type === 'LPAREN') {
      this.consume()
      const e = this.parseExpr()
      if (this.peek()?.type === 'RPAREN') this.consume()
      return e
    }
    this.consume()
    return { kind: 'unknown' }
  }
}

// ── Graph builder ───────────────────────────────────────────────────────────

let _idCounter = 0
function uid(prefix: string) { return `${prefix}_${_idCounter++}` }

interface LiteralOperand {
  side: 'left' | 'right'
  value: number | string
  isPercent: boolean
}

interface WalkResult {
  extraNodes: FlowNode[]
  extraEdges: FlowEdge[]
  outputId: string | null
  operator: Operator
  literalOperand: Omit<LiteralOperand, 'side'> | null
}

const DEFAULT_OP: Operator = '+'

function attachOperand(
  operatorData: OperatorNodeData,
  operatorId: string,
  side: 'left' | 'right',
  result: WalkResult,
): FlowEdge[] {
  if (result.outputId) {
    return [{
      id: uid('e'),
      source: result.outputId,
      target: operatorId,
      type: 'animatedEdge',
      data: { operator: operatorData.operator },
    }]
  }

  if (result.literalOperand) {
    operatorData.literalOperands.push({
      side,
      value: result.literalOperand.value,
      isPercent: result.literalOperand.isPercent,
    })
  }

  return []
}

function collectSumTerms(node: ExprNode): string[] {
  if (node.kind === 'cell') return [node.value]
  if (node.kind === 'number') return [String(node.value)]
  if (node.kind === 'binop' && node.fromSum && node.op === '+') {
    return [...collectSumTerms(node.left), ...collectSumTerms(node.right)]
  }
  return []
}

function walkTree(
  node: ExprNode,
  resultCellId: string,
  currentOp: Operator,
): WalkResult {
  if (node.kind === 'cell') {
    return { extraNodes: [], extraEdges: [], outputId: node.value, operator: currentOp, literalOperand: null }
  }

  if (node.kind === 'number') {
    return {
      extraNodes: [],
      extraEdges: [],
      outputId: null,
      operator: currentOp,
      literalOperand: { value: node.value, isPercent: !!node.isPercent },
    }
  }

  if (node.kind === 'binop') {
    const left = walkTree(node.left, resultCellId, node.op)
    const right = walkTree(node.right, resultCellId, node.op)
    const opId = uid('op')
    const operatorData: OperatorNodeData = {
      operator: node.op,
      literalOperands: [],
      sumTerms: node.fromSum && node.op === '+' ? collectSumTerms(node) : undefined,
    }

    const opNode: FlowNode = {
      id: opId,
      type: 'operatorNode',
      position: { x: 0, y: 0 },
      data: operatorData,
    }

    const ownEdges = node.fromSum && node.op === '+'
      ? [
          ...left.extraEdges,
          ...right.extraEdges,
          ...(left.outputId ? [{
            id: uid('e'),
            source: left.outputId,
            target: opId,
            type: 'animatedEdge' as const,
            data: { operator: operatorData.operator },
          }] : []),
          ...(right.outputId ? [{
            id: uid('e'),
            source: right.outputId,
            target: opId,
            type: 'animatedEdge' as const,
            data: { operator: operatorData.operator },
          }] : []),
        ]
      : [
          ...attachOperand(operatorData, opId, 'left', left),
          ...attachOperand(operatorData, opId, 'right', right),
        ]

    return {
      extraNodes: [...left.extraNodes, ...right.extraNodes, opNode],
      extraEdges: node.fromSum && node.op === '+'
        ? ownEdges
        : [...left.extraEdges, ...right.extraEdges, ...ownEdges],
      outputId: opId,
      operator: node.op,
      literalOperand: null,
    }
  }

  return { extraNodes: [], extraEdges: [], outputId: resultCellId, operator: currentOp, literalOperand: null }
}

// ── Complex formula detection ────────────────────────────────────────────────

/**
 * Functions that the arithmetic tokenizer cannot parse.
 * Cells using these will be rendered with direct dep→cell edges (no operator nodes).
 */
const COMPLEX_FN_RE = /\b(IF|IFS|VLOOKUP|HLOOKUP|INDEX|MATCH|CHOOSE|SWITCH|INDIRECT|OFFSET|SUMIF|SUMIFS|COUNTIF|COUNTIFS|AVERAGEIF|AVERAGEIFS|MAX|MIN|LARGE|SMALL|AND|OR|NOT|IFERROR|ISERROR|ISBLANK|ISNUMBER|ISTEXT|COUNTA|COUNT|AVERAGE|ROUND|ROUNDUP|ROUNDDOWN|INT|ABS|MOD|LEFT|RIGHT|MID|LEN|TRIM|SUBSTITUTE|REPLACE|CONCATENATE|CONCAT|TEXTJOIN|TEXT|FIND|SEARCH|DATE|TODAY|NOW|YEAR|MONTH|DAY|EDATE|EOMONTH|NETWORKDAYS|WORKDAY|RANK|PERCENTILE|STDEV|VAR|CORREL|PMT|PV|FV|RATE|NPV|IRR)\b/i

function isComplexFormula(formula: string): boolean {
  return COMPLEX_FN_RE.test(formula)
}

// ── Public API ──────────────────────────────────────────────────────────────

export function buildFlowGraph(cells: ParsedCell[]): {
  nodes: FlowNode[]
  edges: FlowEdge[]
} {
  _idCounter = 0

  const computeCells = cells.filter(
    c => !(typeof c.value === 'string' && c.formula == null && !c.isMarked)
  )
  const availableAddresses = new Set(computeCells.map(cell => normalizeAddress(cell.address)))

  const externalFormulaAddresses = new Set<string>()
  const cellsWithFormula = computeCells.filter(c => c.formula)

  for (const cell of cellsWithFormula) {
    const expandedFormula = expandSumFormula(cell.formula!, availableAddresses)
    const tokens = tokenize(expandedFormula)
    if (tokens.some(t => t.type === 'EXTERNAL_REF')) {
      externalFormulaAddresses.add(cell.address)
    }
  }

  const graphFormulaCells = cellsWithFormula.filter(c => !externalFormulaAddresses.has(c.address))

  const cellNodes: FlowNode[] = computeCells.map(c => ({
    id: c.address,
    type: 'cellNode' as const,
    position: { x: 0, y: 0 },
    data: {
      address: c.address,
      value: c.value,
      formula: c.formula,
      label: c.label ?? c.comment,
      isInput: !c.formula || externalFormulaAddresses.has(c.address),
      isOutput: false,
      isMarked: c.isMarked,
      isPercent: c.isPercent,
    },
  }))

  const allExtraNodes: FlowNode[] = []
  const allEdges: FlowEdge[] = []

  for (const cell of graphFormulaCells) {
    const sumExpr = parseSumFormulaToExpr(cell.formula!, availableAddresses)
    const expandedFormula = sumExpr ? null : expandSumFormula(cell.formula!, availableAddresses)
    const tokens = expandedFormula ? tokenize(expandedFormula) : []
    const tree = sumExpr ?? new Parser(tokens).parse()
    const result = walkTree(tree, cell.address, DEFAULT_OP)

    allExtraNodes.push(...result.extraNodes)
    allEdges.push(...result.extraEdges)

    if (result.outputId && result.outputId !== cell.address) {
      allEdges.push({
        id: uid('e'),
        source: result.outputId,
        target: cell.address,
        type: 'animatedEdge',
        data: { operator: result.operator },
      })
    }
  }

  // ── Complex formula cells (IF / VLOOKUP / MAX / etc.) ────────────────────
  // These can't be parsed into operator trees. Use the deps array (from Go backend)
  // to create direct cell→cell edges. Mark the node as isComplex for the narration.
  const complexFormulaCells = cellsWithFormula.filter(
    c => isComplexFormula(c.formula!) && c.deps?.length
  )
  const complexCellIds = new Set(complexFormulaCells.map(c => c.address))

  for (const cell of complexFormulaCells) {
    for (const dep of cell.deps!) {
      if (availableAddresses.has(dep) && dep !== cell.address) {
        allEdges.push({
          id: uid('e'),
          source: dep,
          target: cell.address,
          type: 'animatedEdge',
          data: { operator: '+' },
        })
      }
    }
  }

  const hasIncoming = new Set(allEdges.map(e => e.target))
  const hasOutgoing = new Set(allEdges.map(e => e.source))
  const formulaCellIds = new Set(graphFormulaCells.map(c => c.address))
  const markedCells = computeCells.filter(c => c.isMarked)

  let markedStartAddress: string | undefined
  let markedEndAddress: string | undefined

  if (markedCells.length === 2) {
    const [c1, c2] = markedCells
    const c1Score = (formulaCellIds.has(c1.address) ? 2 : 0) + (hasIncoming.has(c1.address) ? 1 : 0)
    const c2Score = (formulaCellIds.has(c2.address) ? 2 : 0) + (hasIncoming.has(c2.address) ? 1 : 0)
    
    if (c1Score < c2Score) {
      markedStartAddress = c1.address
      markedEndAddress = c2.address
    } else if (c2Score < c1Score) {
      markedStartAddress = c2.address
      markedEndAddress = c1.address
    } else {
      markedStartAddress = c1.address
      markedEndAddress = c2.address
    }
  } else {
    markedStartAddress = markedCells.find(c => !formulaCellIds.has(c.address) && !hasIncoming.has(c.address))?.address
      ?? markedCells.find(c => !formulaCellIds.has(c.address))?.address
      ?? markedCells[0]?.address

    markedEndAddress = [...markedCells].reverse().find(c => formulaCellIds.has(c.address) && !hasOutgoing.has(c.address))?.address
      ?? [...markedCells].reverse().find(c => formulaCellIds.has(c.address))?.address
      ?? markedCells[markedCells.length - 1]?.address
  }

  const updatedCellNodes = cellNodes.map(n => {
    if (n.type !== 'cellNode') return n
    const cell = computeCells.find(c => c.address === n.id)
    const isMarkedStart = n.id === markedStartAddress
    const isMarkedEnd = n.id === markedEndAddress && markedEndAddress !== markedStartAddress

    let isInput = !cell?.formula || externalFormulaAddresses.has(n.id)
    let isOutput = (formulaCellIds.has(n.id) || complexCellIds.has(n.id)) && !hasOutgoing.has(n.id)
    const isComplex = complexCellIds.has(n.id)

    if (markedCells.length > 0) {
      if (isMarkedStart) {
        isInput = true
        isOutput = false
      }
      if (isMarkedEnd) {
        isOutput = true
        isInput = false
      }
      if (cell?.isMarked && !isMarkedStart && !isMarkedEnd) {
        isInput = !cell.formula || externalFormulaAddresses.has(n.id)
      }
    }

    return { ...n, data: { ...n.data, isInput, isOutput, isComplex } }
  })

  const { nodes: rawMergedNodes, edges: rawMergedEdges } = {
    nodes: [...updatedCellNodes, ...allExtraNodes],
    edges: allEdges,
  }

  // ── Collapse pipeline ────────────────────────────────────────────────────────
  // Phase 1: equal-arithmetic-constant groups (green)
  let { nodes: pn, edges: pe } = collapseArithmeticGroups(
    rawMergedNodes, rawMergedEdges, computeCells)
  // Phase 2a: SUM fan-in clusters (sky)
  ;({ nodes: pn, edges: pe } = collapseSumClusters(pn, pe))
  // Phase 2b: same-value input deduplication (amber)
  ;({ nodes: pn, edges: pe } = collapseValueDuplicates(pn, pe))
  // Phase 2c: linear chain compression (violet)
  ;({ nodes: pn, edges: pe } = collapseLinearChains(pn, pe))
  // Phase 2d: remove truly isolated nodes (no edges at all)
  ;({ nodes: pn, edges: pe } = pruneIsolatedNodes(pn, pe))

  return { nodes: pn, edges: pe }
}

// ────────────────────────────────────────────────────────────────────────────────
interface GroupCandidate {
  op: Operator
  constant: number
  constantIsPercent: boolean
  /** cellNode ids that are the *output* of (srcCell op constant) */
  targetCellIds: string[]
  /** operatorNode ids that implement this pattern for each target */
  operatorNodeIds: string[]
  /** source cellNode/groupNode id feeding each operator */
  sourceCellIds: string[]
}

/**
 * Generate a short, readable annotation for the group.
 */
function generateAnnotation(
  op: Operator,
  k: number,
  kIsPercent: boolean,
  labels: string[],
  numDec: number,
): string {
  const opWord: Record<Operator, string> = { '+': '加上', '-': '减去', '*': '乘以', '/': '除以' }
  const verb = opWord[op]
  const kStr = kIsPercent
    ? `${(k * 100).toFixed(numDec)}%`
    : k.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 4 })
  const subject =
    labels.length <= 2
      ? labels.join('、')
      : `${labels[0]} 等 ${labels.length} 项`
  return `${subject}均${verb}同一常数 ${kStr}`
}

function collapseArithmeticGroups(
  nodes: FlowNode[],
  edges: FlowEdge[],
  _parsedCells: ParsedCell[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const MIN_GROUP_SIZE = 3

  // Build quick-lookup maps
  const nodeById = new Map<string, FlowNode>(nodes.map(n => [n.id, n]))

  // Candidate map: key = "op|roundedConstant"
  const candidates = new Map<string, GroupCandidate>()

  for (const node of nodes) {
    if (node.type !== 'operatorNode') continue
    const opData = node.data as OperatorNodeData

    // Must have exactly one literal operand
    if (opData.literalOperands.length !== 1) continue
    const lit = opData.literalOperands[0]
    const k = Number(lit.value)
    if (!isFinite(k)) continue

    const op = opData.operator

    // Find the cellNode this operator feeds into (via out-edge)
    const outEdge = edges.find(e => e.source === node.id)
    if (!outEdge) continue
    const targetNode = nodeById.get(outEdge.target)
    if (!targetNode || targetNode.type !== 'cellNode') continue

    // Find the source cellNode feeding into the operator (via in-edge)
    const inEdges = edges.filter(e => e.target === node.id)
    if (inEdges.length !== 1) continue // must have exactly one cell source
    const srcNode = nodeById.get(inEdges[0].source)
    if (!srcNode || srcNode.type !== 'cellNode') continue

    // Key: operator + constant (rounded for float safety)
    const keyK = Math.round(k * 1e8) / 1e8
    const key = `${op}|${keyK}`

    if (!candidates.has(key)) {
      candidates.set(key, {
        op,
        constant: k,
        constantIsPercent: lit.isPercent,
        targetCellIds: [],
        operatorNodeIds: [],
        sourceCellIds: [],
      })
    }
    const cand = candidates.get(key)!
    cand.targetCellIds.push(targetNode.id)
    cand.operatorNodeIds.push(node.id)
    cand.sourceCellIds.push(srcNode.id)
  }

  // Filter to groups that meet the minimum size
  const groups = [...candidates.values()].filter(c => c.targetCellIds.length >= MIN_GROUP_SIZE)

  if (groups.length === 0) return { nodes, edges }

  // Collect all ids that will be removed
  const removedCellIds = new Set<string>()
  const removedOpIds   = new Set<string>()

  const newGroupNodes: FlowNode[] = []
  // Maps from old target cellId → groupNode id (for re-routing edges)
  const cellToGroup = new Map<string, string>()

  for (const group of groups) {
    // Prevent same cell being in two groups (shouldn't happen, but safety guard)
    const members = group.targetCellIds.filter(id => !removedCellIds.has(id))
    const ops     = group.operatorNodeIds.filter((_, i) => !removedCellIds.has(group.targetCellIds[i]))

    if (members.length < MIN_GROUP_SIZE) continue

    // Ensure none of the members depend on each other
    const memberSet = new Set(members)
    const hasCross = edges.some(
      e => memberSet.has(e.source as string) && memberSet.has(e.target as string),
    )
    if (hasCross) continue

    // Pick representative = first member (position, for layout)
    const representativeId = members[0]
    const repNode = nodeById.get(representativeId)!
    const groupId = uid('grp')

    // Build member metadata
    const memberLabels = members.map(mid => {
      const cell = nodeById.get(mid)
      if (cell?.type === 'cellNode') {
        const lbl = cell.data.label
        return (typeof lbl === 'string' && lbl.trim()) ? lbl.trim() : (cell.data.address as string)
      }
      return mid
    })
    const memberValues = members.map(mid => {
      const cell = nodeById.get(mid)
      return cell?.type === 'cellNode' ? (cell.data.value as number | string | null) : null
    })
    const memberIsPercent = members.map(mid => {
      const cell = nodeById.get(mid)
      return cell?.type === 'cellNode' ? Boolean(cell.data.isPercent) : false
    })

    const groupData: ArithmeticGroupNodeData = {
      memberIds: members,
      memberLabels,
      memberValues,
      memberIsPercent,
      operator: group.op,
      constant: group.constant,
      constantIsPercent: group.constantIsPercent,
      annotation: generateAnnotation(group.op, group.constant, group.constantIsPercent, memberLabels, 2),
      representativeId,
    }

    const groupNode: FlowNode = {
      id: groupId,
      type: 'arithmeticGroupNode' as const,
      position: repNode.position,
      data: groupData,
    } as FlowNode

    newGroupNodes.push(groupNode)

    members.forEach(mid => {
      removedCellIds.add(mid)
      cellToGroup.set(mid, groupId)
    })
    ops.forEach(oid => removedOpIds.add(oid))
    // Also mark source cells that fed exclusively into this group's operators
    // (we keep source cells in the graph, only remove the operator + target cell)
  }

  // Re-wire edges
  const finalEdges: FlowEdge[] = []
  const seenEdgeKeys = new Set<string>()

  for (const edge of edges) {
    const src = edge.source as string
    const tgt = edge.target as string

    // Drop edges whose source or target is a removed operatorNode or grouped cellNode
    if (removedOpIds.has(src) || removedOpIds.has(tgt)) continue
    if (removedCellIds.has(src)) continue // edges FROM removed cells are gone
    // For edges TO a removed cell, redirect to the group
    if (removedCellIds.has(tgt)) {
      const grpId = cellToGroup.get(tgt)
      if (!grpId) continue
      // Source could be an operator node that feeds into the grouped cell —
      // those were already removed. Only keep if source is a non-removed node.
      if (removedOpIds.has(src)) continue
      const key = `${src}->${grpId}`
      if (!seenEdgeKeys.has(key)) {
        seenEdgeKeys.add(key)
        finalEdges.push({ ...edge, id: uid('e'), target: grpId })
      }
      continue
    }
    finalEdges.push(edge)
  }

  // Add representative outgoing edges from each group to downstream consumers
  // (edges that originally left one of the member cellNodes)
  for (const [cellId, grpId] of cellToGroup.entries()) {
    const downstream = edges.filter(e => e.source === cellId)
    for (const de of downstream) {
      const tgt = de.target as string
      if (removedOpIds.has(tgt) || removedCellIds.has(tgt)) continue
      const key = `${grpId}->${tgt}`
      if (!seenEdgeKeys.has(key)) {
        seenEdgeKeys.add(key)
        finalEdges.push({ ...de, id: uid('e'), source: grpId })
      }
    }
  }

  // Filter out removed nodes
  const finalNodes: FlowNode[] = [
    ...nodes.filter(n => !removedCellIds.has(n.id) && !removedOpIds.has(n.id)),
    ...newGroupNodes,
  ]

  return { nodes: finalNodes, edges: finalEdges }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function computeTopoDepth(nodes: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const depth  = new Map<string, number>()
  const outMap = new Map<string, string[]>()
  const inDeg  = new Map<string, number>()
  nodes.forEach(n => { outMap.set(n.id, []); inDeg.set(n.id, 0) })
  edges.forEach(e => {
    outMap.get(e.source as string)?.push(e.target as string)
    inDeg.set(e.target as string, (inDeg.get(e.target as string) ?? 0) + 1)
  })
  const queue = nodes.filter(n => (inDeg.get(n.id) ?? 0) === 0).map(n => { depth.set(n.id, 0); return n.id })
  let i = 0
  while (i < queue.length) {
    const cur = queue[i++]
    const d = depth.get(cur) ?? 0
    for (const next of outMap.get(cur) ?? []) {
      if (!depth.has(next) || depth.get(next)! < d + 1) { depth.set(next, d + 1); queue.push(next) }
    }
  }
  return depth
}

function buildEdgeMaps(nodes: FlowNode[], edges: FlowEdge[]) {
  const outMap = new Map<string, FlowEdge[]>()
  const inMap  = new Map<string, FlowEdge[]>()
  nodes.forEach(n => { outMap.set(n.id, []); inMap.set(n.id, []) })
  edges.forEach(e => {
    outMap.get(e.source as string)?.push(e)
    inMap.get(e.target as string)?.push(e)
  })
  return { outMap, inMap }
}

// ── Phase 2a: SUM fan-in cluster (sky) ───────────────────────────────────────

function collapseSumClusters(nodes: FlowNode[], edges: FlowEdge[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const MIN_MEMBERS = 5
  const nodeById = new Map<string, FlowNode>(nodes.map(n => [n.id, n]))
  const { outMap, inMap } = buildEdgeMaps(nodes, edges)
  const removedIds = new Set<string>()
  const newNodes: FlowNode[] = []
  const newEdges: FlowEdge[] = []

  for (const node of nodes) {
    if (node.type !== 'operatorNode' || removedIds.has(node.id)) continue
    const opData = node.data as OperatorNodeData
    if (opData.operator !== '+' || !opData.sumTerms || opData.sumTerms.length < MIN_MEMBERS) continue

    const pureLeaves = (inMap.get(node.id) ?? []).map(e => e.source as string).filter(id => {
      const n = nodeById.get(id)
      if (!n || n.type !== 'cellNode' || !n.data.isInput) return false
      const outs = outMap.get(id) ?? []
      return outs.length === 1 && outs[0].target === node.id
    })
    if (pureLeaves.length < MIN_MEMBERS) continue

    const vals  = pureLeaves.map(id => Number(nodeById.get(id)!.data.value ?? 0)).filter(Number.isFinite)
    const total = vals.reduce((a, b) => a + b, 0)
    const min   = Math.min(...vals)
    const max   = Math.max(...vals)
    const mean  = vals.length > 0 ? total / vals.length : 0
    const resultEdge = (outMap.get(node.id) ?? [])[0]
    const clusterId = uid('sumc')
    const repNode   = nodeById.get(pureLeaves[0])!

    const memberLabels = pureLeaves.map(id => {
      const n = nodeById.get(id)!
      const lbl = n.data.label
      return (typeof lbl === 'string' && lbl.trim()) ? lbl.trim() : (n.data.address as string)
    })

    const clusterData: SumClusterNodeData = {
      memberIds: pureLeaves,
      memberLabels,
      memberValues:    pureLeaves.map(id => nodeById.get(id)!.data.value as number | string | null),
      memberIsPercent: pureLeaves.map(id => Boolean(nodeById.get(id)!.data.isPercent)),
      total, count: pureLeaves.length, min, max, mean,
      annotation: `${pureLeaves.length} 项数据的 SUM 汇总`,
      representativeId: pureLeaves[0],
    }
    newNodes.push({ id: clusterId, type: 'sumClusterNode' as const, position: repNode.position, data: clusterData } as FlowNode)
    pureLeaves.forEach(id => removedIds.add(id))
    removedIds.add(node.id)
    if (resultEdge) {
      newEdges.push({ id: uid('e'), source: clusterId, target: resultEdge.target as string, type: 'animatedEdge', data: { operator: '+' as const } })
    }
  }

  if (newNodes.length === 0) return { nodes, edges }
  return {
    nodes: [...nodes.filter(n => !removedIds.has(n.id)), ...newNodes],
    edges: [...edges.filter(e => !removedIds.has(e.source as string) && !removedIds.has(e.target as string)), ...newEdges],
  }
}

// ── Phase 2b: Same-value input deduplication (amber) ─────────────────────────

function collapseValueDuplicates(nodes: FlowNode[], edges: FlowEdge[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const MIN_SIZE = 2
  const inputCells = nodes.filter(n => n.type === 'cellNode' && Boolean(n.data.isInput) && typeof n.data.value === 'number')
  if (inputCells.length < MIN_SIZE) return { nodes, edges }

  const depth = computeTopoDepth(nodes, edges)
  const groups = new Map<string, string[]>()
  for (const cell of inputCells) {
    const key = String(Math.round((cell.data.value as number) * 1e6) / 1e6)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(cell.id)
  }

  const validGroups = [...groups.values()].filter(ids => ids.length >= MIN_SIZE)
  if (validGroups.length === 0) return { nodes, edges }

  const nodeById = new Map<string, FlowNode>(nodes.map(n => [n.id, n]))
  const removedIds = new Set<string>()
  const newNodes: FlowNode[] = []
  const idToGroupId = new Map<string, string>()

  for (const memberIds of validGroups) {
    const sorted = [...memberIds].sort((a, b) => (depth.get(b) ?? 0) - (depth.get(a) ?? 0))
    const representativeId = sorted[0]
    const repNode = nodeById.get(representativeId)!
    const groupId = uid('vdup')

    const memberLabels = memberIds.map(id => {
      const n = nodeById.get(id)!
      const lbl = n.data.label
      return (typeof lbl === 'string' && lbl.trim()) ? lbl.trim() : (n.data.address as string)
    })

    const groupData: ValueDuplicateNodeData = {
      value: repNode.data.value as number | string | null,
      isPercent: Boolean(repNode.data.isPercent),
      memberIds, memberLabels, representativeId,
      annotation: `${memberIds.length} 处引用同一数值`,
    }
    newNodes.push({ id: groupId, type: 'valueDuplicateNode' as const, position: repNode.position, data: groupData } as FlowNode)
    memberIds.forEach(id => { removedIds.add(id); idToGroupId.set(id, groupId) })
  }

  const seenKeys = new Set<string>()
  const finalEdges: FlowEdge[] = []
  for (const edge of edges) {
    const src = edge.source as string
    const tgt = edge.target as string
    if (removedIds.has(src)) {
      const grpId = idToGroupId.get(src)!
      const key = `${grpId}->${tgt}`
      if (!seenKeys.has(key)) { seenKeys.add(key); finalEdges.push({ ...edge, id: uid('e'), source: grpId }) }
    } else if (!removedIds.has(tgt)) {
      finalEdges.push(edge)
    }
  }
  return { nodes: [...nodes.filter(n => !removedIds.has(n.id)), ...newNodes], edges: finalEdges }
}

// ── Phase 2c: Linear chain compression (violet) ───────────────────────────────

function buildIntermediateSet(
  nodes: FlowNode[],
  outMap: Map<string, FlowEdge[]>,
  inMap: Map<string, FlowEdge[]>,
  nodeById: Map<string, FlowNode>,
): Set<string> {
  const s = new Set<string>()
  for (const node of nodes) {
    if (node.type !== 'cellNode') continue
    const ins = inMap.get(node.id) ?? []
    if (ins.length !== 1) continue
    const inOpId = ins[0].source as string
    const inOp = nodeById.get(inOpId)
    if (!inOp || inOp.type !== 'operatorNode') continue
    if ((inMap.get(inOpId) ?? []).length !== 1 || (outMap.get(inOpId) ?? []).length !== 1) continue
    const outs = outMap.get(node.id) ?? []
    if (outs.length !== 1) continue
    const outOpId = outs[0].target as string
    const outOp = nodeById.get(outOpId)
    if (!outOp || outOp.type !== 'operatorNode') continue
    if ((inMap.get(outOpId) ?? []).length !== 1 || (outMap.get(outOpId) ?? []).length !== 1) continue
    s.add(node.id)
  }
  return s
}

function tryAdvance(
  cellId: string,
  outMap: Map<string, FlowEdge[]>,
  inMap: Map<string, FlowEdge[]>,
  nodeById: Map<string, FlowNode>,
): { opId: string; nextCellId: string } | null {
  const outs = outMap.get(cellId) ?? []
  if (outs.length !== 1) return null
  const opId = outs[0].target as string
  const op = nodeById.get(opId)
  if (!op || op.type !== 'operatorNode') return null
  if ((inMap.get(opId) ?? []).length !== 1 || (outMap.get(opId) ?? []).length !== 1) return null
  const nextCellId = (outMap.get(opId) ?? [])[0]?.target as string
  const nextCell = nodeById.get(nextCellId)
  if (!nextCell || nextCell.type !== 'cellNode') return null
  if ((inMap.get(nextCellId) ?? []).length !== 1) return null
  return { opId, nextCellId }
}

function collapseLinearChains(nodes: FlowNode[], edges: FlowEdge[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const MIN_CELLS = 3
  const nodeById = new Map<string, FlowNode>(nodes.map(n => [n.id, n]))
  const { outMap, inMap } = buildEdgeMaps(nodes, edges)
  const intermediates = buildIntermediateSet(nodes, outMap, inMap, nodeById)

  const removedIds = new Set<string>()
  const newNodes: FlowNode[] = []
  const newEdges: FlowEdge[] = []

  for (const node of nodes) {
    if (node.type !== 'cellNode' || intermediates.has(node.id) || removedIds.has(node.id)) continue

    const cells: string[] = [node.id]
    const ops: string[] = []
    let cur = node.id

    while (true) {
      const adv = tryAdvance(cur, outMap, inMap, nodeById)
      if (!adv) break
      cells.push(adv.nextCellId)
      ops.push(adv.opId)
      if (!intermediates.has(adv.nextCellId)) break
      cur = adv.nextCellId
    }

    if (cells.length < MIN_CELLS) continue

    const chainId = uid('chain')
    const steps: ChainStep[] = cells.map((cid, i) => {
      const cn = nodeById.get(cid)!
      const d  = cn.data as Record<string, unknown>
      const lbl = (typeof d.label === 'string' && (d.label as string).trim())
        ? (d.label as string).trim() : (d.address as string) ?? cid
      const opNode = i < ops.length ? nodeById.get(ops[i]) : undefined
      const opData = opNode?.data as OperatorNodeData | undefined
      const lit    = opData?.literalOperands?.[0]
      return {
        cellId: cid, label: lbl,
        value: (d.value as number | string | null) ?? null,
        isPercent: Boolean(d.isPercent),
        opToNext: opData?.operator ?? null,
        constantToNext: lit ? Number(lit.value) : null,
        constantIsPercentToNext: lit ? Boolean(lit.isPercent) : false,
      }
    })

    newNodes.push({
      id: chainId, type: 'chainNode' as const,
      position: nodeById.get(cells[0])!.position,
      data: {
        steps,
        annotation: `${steps[0].label} 经 ${steps.length - 1} 步运算至 ${steps[steps.length - 1].label}`,
      } as ChainNodeData,
    } as FlowNode)

    for (let i = 1; i < cells.length - 1; i++) removedIds.add(cells[i])
    ops.forEach(id => removedIds.add(id))

    const f = (nodeById.get(ops[0])?.data as OperatorNodeData | undefined)?.operator ?? '+'
    const l = (nodeById.get(ops[ops.length - 1])?.data as OperatorNodeData | undefined)?.operator ?? '+'
    newEdges.push({ id: uid('e'), source: cells[0], target: chainId, type: 'animatedEdge', data: { operator: f } })
    newEdges.push({ id: uid('e'), source: chainId, target: cells[cells.length - 1], type: 'animatedEdge', data: { operator: l } })
  }

  if (newNodes.length === 0) return { nodes, edges }
  return {
    nodes: [...nodes.filter(n => !removedIds.has(n.id)), ...newNodes],
    edges: [...edges.filter(e => !removedIds.has(e.source as string) && !removedIds.has(e.target as string)), ...newEdges],
  }
}

// ── Phase 2d: Prune isolated nodes ────────────────────────────────────────────

function pruneIsolatedNodes(nodes: FlowNode[], edges: FlowEdge[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const connected = new Set<string>()
  edges.forEach(e => { connected.add(e.source as string); connected.add(e.target as string) })
  return {
    nodes: nodes.filter(n =>
      connected.has(n.id) ||
      (n.type === 'cellNode' && Boolean(n.data.isMarked || n.data.isInput || n.data.isOutput)),
    ),
    edges,
  }
}
