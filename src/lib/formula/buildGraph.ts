import type { FlowNode, FlowEdge, ParsedCell, Operator } from '../../types'
import { tokenize } from './tokenize'
import type { Token } from './tokenize'

// ── Expression tree types ───────────────────────────────────────────────────

type ExprNode =
  | { kind: 'cell';   value: string }
  | { kind: 'number'; value: number }
  | { kind: 'binop';  op: Operator; left: ExprNode; right: ExprNode }
  | { kind: 'unknown' }

// ── Recursive-descent parser with precedence ────────────────────────────────

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => t.type !== 'UNKNOWN')
  }

  private peek(): Token | null { return this.tokens[this.pos] ?? null }
  private consume(): Token { return this.tokens[this.pos++] }

  parse(): ExprNode {
    return this.parseExpr()
  }

  // expr = term (('+' | '-') term)*
  private parseExpr(): ExprNode {
    let left = this.parseTerm()
    while (this.peek()?.type === 'OPERATOR' && '+-'.includes(this.peek()!.value)) {
      const op = this.consume().value as Operator
      const right = this.parseTerm()
      left = { kind: 'binop', op, left, right }
    }
    return left
  }

  // term = unary (('*' | '/') unary)*
  private parseTerm(): ExprNode {
    let left = this.parseUnary()
    while (this.peek()?.type === 'OPERATOR' && '*/'.includes(this.peek()!.value)) {
      const op = this.consume().value as Operator
      const right = this.parseUnary()
      left = { kind: 'binop', op, left, right }
    }
    return left
  }

  // unary = '-'? factor
  private parseUnary(): ExprNode {
    if (this.peek()?.type === 'OPERATOR' && this.peek()?.value === '-') {
      this.consume()
      const f = this.parseFactor()
      if (f.kind === 'number') return { kind: 'number', value: -f.value }
      return { kind: 'binop', op: '*', left: { kind: 'number', value: -1 }, right: f }
    }
    return this.parseFactor()
  }

  // factor = CELL_REF | NUMBER | '(' expr ')'
  private parseFactor(): ExprNode {
    const t = this.peek()
    if (!t) return { kind: 'unknown' }
    if (t.type === 'CELL_REF') { this.consume(); return { kind: 'cell', value: t.value } }
    if (t.type === 'NUMBER') { this.consume(); return { kind: 'number', value: parseFloat(t.value) } }
    if (t.type === 'LPAREN') {
      this.consume()
      const e = this.parseExpr()
      if (this.peek()?.type === 'RPAREN') this.consume()
      return e
    }
    // Skip unknown tokens
    this.consume()
    return { kind: 'unknown' }
  }
}

// ── Graph builder ───────────────────────────────────────────────────────────

let _idCounter = 0
function uid(prefix: string) { return `${prefix}_${_idCounter++}` }

interface WalkResult {
  extraNodes: FlowNode[]
  extraEdges: FlowEdge[]
  outputId: string       // ID of the node that produces this sub-expression's value
  operator: Operator     // the top-level op of this sub-expression (for edge coloring)
}

const DEFAULT_OP: Operator = '+'

function walkTree(
  node: ExprNode,
  resultCellId: string,
  currentOp: Operator,
): WalkResult {
  if (node.kind === 'cell') {
    return { extraNodes: [], extraEdges: [], outputId: node.value, operator: currentOp }
  }

  if (node.kind === 'number') {
    const constId = uid('const')
    const constNode: FlowNode = {
      id: constId,
      type: 'constantNode',
      position: { x: 0, y: 0 },
      data: { value: node.value },
    }
    return { extraNodes: [constNode], extraEdges: [], outputId: constId, operator: currentOp }
  }

  if (node.kind === 'binop') {
    const left  = walkTree(node.left,  resultCellId, node.op)
    const right = walkTree(node.right, resultCellId, node.op)
    const opId  = uid('op')

    const opNode: FlowNode = {
      id: opId,
      type: 'operatorNode',
      position: { x: 0, y: 0 },
      data: { operator: node.op, constantLabels: [] },
    }

    const edgeLeft: FlowEdge = {
      id: uid('e'),
      source: left.outputId,
      target: opId,
      type: 'animatedEdge',
      data: { operator: node.op },
    }
    const edgeRight: FlowEdge = {
      id: uid('e'),
      source: right.outputId,
      target: opId,
      type: 'animatedEdge',
      data: { operator: node.op },
    }

    return {
      extraNodes: [...left.extraNodes, ...right.extraNodes, opNode],
      extraEdges: [...left.extraEdges, ...right.extraEdges, edgeLeft, edgeRight],
      outputId: opId,
      operator: node.op,
    }
  }

  // unknown / fallback
  return { extraNodes: [], extraEdges: [], outputId: resultCellId, operator: currentOp }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function buildFlowGraph(cells: ParsedCell[]): {
  nodes: FlowNode[]
  edges: FlowEdge[]
} {
  _idCounter = 0

  // Text-only cells (labels) are absorbed as labels into adjacent cells — skip them as graph nodes
  const computeCells = cells.filter(
    c => !(typeof c.value === 'string' && c.formula == null && !c.isMarked)
  )

  // Set of all cell addresses referenced by any formula (used to mark inputs)
  const formulaSourceRefs = new Set<string>()
  const cellsWithFormula = computeCells.filter(c => c.formula)

  // First pass: collect all cells referenced in formulas
  for (const cell of cellsWithFormula) {
    const tokens = tokenize(cell.formula!)
    tokens.filter(t => t.type === 'CELL_REF').forEach(t => formulaSourceRefs.add(t.value))
  }

  // Create base cellNode for every compute cell
  const cellNodes: FlowNode[] = computeCells.map(c => ({
    id: c.address,
    type: 'cellNode' as const,
    position: { x: 0, y: 0 },
    data: {
      address: c.address,
      value: c.value,
      formula: c.formula,
      label: c.label ?? c.comment,
      // isMarked cells: no formula = 起点, has formula = 终点
      // fallback: no formula = input, formula with no incoming = output
      isInput: !c.formula,
      isOutput: false,
      isMarked: c.isMarked,
      isPercent: c.isPercent,
    },
  }))

  const allExtraNodes: FlowNode[] = []
  const allEdges: FlowEdge[] = []

  // Second pass: parse each formula and build operator sub-graphs
  for (const cell of cellsWithFormula) {
    const tokens = tokenize(cell.formula!)
    const tree = new Parser(tokens).parse()
    const result = walkTree(tree, cell.address, DEFAULT_OP)

    allExtraNodes.push(...result.extraNodes)
    allEdges.push(...result.extraEdges)

    // Final edge: opTree output → this cell
    if (result.outputId !== cell.address) {
      allEdges.push({
        id: uid('e'),
        source: result.outputId,
        target: cell.address,
        type: 'animatedEdge',
        data: { operator: result.operator },
      })
    }
  }

  // Mark cells that have no incoming edges as outputs if they have formulas
  // (naive heuristic: last cell alphabetically with a formula is the "output")
  const hasIncoming = new Set(allEdges.map(e => e.target))
  const formulaCellIds = new Set(cellsWithFormula.map(c => c.address))

  // Build a set of marked addresses for quick lookup
  const markedAddresses = new Set(computeCells.filter(c => c.isMarked).map(c => c.address))

  const updatedCellNodes = cellNodes.map(n => {
    if (n.type !== 'cellNode') return n
    const cell = computeCells.find(c => c.address === n.id)
    // If explicitly marked via purple fill: formula = 终点, no formula = 起点
    // Otherwise fall back to graph-structure heuristic
    let isOutput: boolean
    if (markedAddresses.has(n.id)) {
      isOutput = !!(cell?.formula)
    } else {
      isOutput = formulaCellIds.has(n.id) && !hasIncoming.has(n.id)
    }
    return { ...n, data: { ...n.data, isOutput } }
  })

  return {
    nodes: [...updatedCellNodes, ...allExtraNodes],
    edges: allEdges,
  }
}
