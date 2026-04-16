import { useEffect, useRef, useState, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore as useRFStore,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ChevronUp, ChevronDown } from 'lucide-react'

import { CellNode }     from '../nodes/CellNode'
import { OperatorNode } from '../nodes/OperatorNode'
import { ArithmeticGroupNode } from '../nodes/ArithmeticGroupNode'
import { ValueDuplicateNode } from '../nodes/ValueDuplicateNode'
import { ChainNode } from '../nodes/ChainNode'
import { SumClusterNode } from '../nodes/SumClusterNode'
import { AnimatedEdge } from '../edges/AnimatedEdge'
import { AnimationBar } from '../AnimationBar/AnimationBar'
import { useFlowStore } from '../../store/flowStore'
import type { FlowNode, FlowEdge } from '../../types'
import type { GlobalLevel } from '../../store/flowStore'

const nodeTypes: NodeTypes = {
  cellNode:             CellNode as any,
  operatorNode:         OperatorNode as any,
  arithmeticGroupNode:  ArithmeticGroupNode as any,
  valueDuplicateNode:   ValueDuplicateNode as any,
  chainNode:            ChainNode as any,
  sumClusterNode:       SumClusterNode as any,
}
const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge as any,
}

const LEGEND = [
  { op: '+', color: '#22c55e', label: '加法' },
  { op: '-', color: '#ef4444', label: '减法' },
  { op: '*', color: '#3b82f6', label: '乘法' },
  { op: '/', color: '#f97316', label: '除法' },
]

function StepBtn({
  onClick, disabled, children,
}: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center w-5 h-5 rounded border border-lpf-border bg-lpf-surface hover:border-lpf-border-light hover:bg-lpf-card disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}

function DisplayPanel() {
  const { displaySettings, setDisplaySettings } = useFlowStore()
  const { numberDecimals, percentMode, percentDecimals } = displaySettings

  const clamp = (v: number) => Math.max(0, Math.min(3, v))

  return (
    <div className="mt-2 pt-2 border-t border-lpf-border">
      <p className="text-[9px] text-lpf-subtle uppercase tracking-widest mb-2 font-medium">显示精度</p>

      {/* Number decimals */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] text-lpf-muted">数值</span>
        <div className="flex items-center gap-1">
          <StepBtn onClick={() => setDisplaySettings({ numberDecimals: clamp(numberDecimals - 1) })} disabled={numberDecimals <= 0}>
            <ChevronDown className="w-3 h-3 text-lpf-muted" />
          </StepBtn>
          <span className="text-[12px] font-mono text-lpf-text w-3 text-center">{numberDecimals}</span>
          <StepBtn onClick={() => setDisplaySettings({ numberDecimals: clamp(numberDecimals + 1) })} disabled={numberDecimals >= 3}>
            <ChevronUp className="w-3 h-3 text-lpf-muted" />
          </StepBtn>
        </div>
      </div>

      {/* Percent mode toggle + decimals */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[11px] text-lpf-muted">参数</span>
        <button
          onClick={() => setDisplaySettings({ percentMode: !percentMode })}
          className={[
            'text-[10px] font-mono px-2 py-0.5 rounded border transition-colors',
            percentMode
              ? 'border-sky-700/60 bg-sky-900/30 text-sky-400'
              : 'border-lpf-border bg-transparent text-lpf-subtle hover:border-lpf-border-light',
          ].join(' ')}
          title={percentMode ? '当前：百分比显示' : '当前：小数显示'}
        >
          {percentMode ? '%' : '0.x'}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-lpf-subtle pl-2">位数</span>
        <div className="flex items-center gap-1">
          <StepBtn onClick={() => setDisplaySettings({ percentDecimals: clamp(percentDecimals - 1) })} disabled={percentDecimals <= 0}>
            <ChevronDown className="w-3 h-3 text-lpf-muted" />
          </StepBtn>
          <span className="text-[12px] font-mono text-lpf-text w-3 text-center">{percentDecimals}</span>
          <StepBtn onClick={() => setDisplaySettings({ percentDecimals: clamp(percentDecimals + 1) })} disabled={percentDecimals >= 3}>
            <ChevronUp className="w-3 h-3 text-lpf-muted" />
          </StepBtn>
        </div>
      </div>
    </div>
  )
}

function formatNarrationValue(
  v: number | string | null,
  isPercent: boolean,
  numDec: number,
  pctMode: boolean,
  pctDec: number,
) {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (isPercent && pctMode) {
    return (v * 100).toLocaleString('zh-CN', {
      minimumFractionDigits: pctDec,
      maximumFractionDigits: pctDec,
    }) + '%'
  }

  const dec = isPercent ? pctDec : numDec
  return v.toLocaleString('zh-CN', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function getNodeLabel(node: FlowNode | undefined) {
  if (!node) return '未知项'
  if (node.type === 'cellNode') {
    return typeof node.data.label === 'string' && node.data.label.trim()
      ? node.data.label.trim()
      : node.data.address
  }
  return '计算项'
}

/** Extract leading function name from a formula string, e.g. "=IF(..." → "IF" */
function getFormulaFuncName(formula: string | null): string | null {
  if (!formula) return null
  const m = formula.match(/^=\s*([A-Z]+)\s*\(/i)
  return m ? m[1].toUpperCase() : null
}

type DS = { numberDecimals: number; percentMode: boolean; percentDecimals: number }

function fmtV(node: FlowNode, ds: DS): string {
  if (node.type !== 'cellNode') return '—'
  return formatNarrationValue(
    node.data.value, node.data.isPercent,
    ds.numberDecimals, ds.percentMode, ds.percentDecimals,
  )
}

function isInputCell(node: FlowNode, edges: FlowEdge[]): boolean {
  if (node.type !== 'cellNode') return false
  return node.data.isInput || edges.filter(e => e.target === node.id).length === 0
}

/**
 * Build a natural-language phrase describing how a calc cell was derived.
 * Returns only the core description (no leading connector, no trailing 。).
 */
function buildCalcDesc(
  node: FlowNode,
  nodes: FlowNode[],
  edges: FlowEdge[],
  ds: DS,
): string {
  if (node.type !== 'cellNode') return ''
  const label = getNodeLabel(node)
  const value = fmtV(node, ds)

  // Complex formula (IF / VLOOKUP / etc.)
  if (node.data.isComplex) {
    const funcName = getFormulaFuncName((node.data.formula as string | null) ?? null)
    const incoming = edges.filter(e => e.target === node.id)
    const deps = incoming
      .map(e => nodes.find(n => n.id === e.source))
      .filter((n): n is FlowNode => Boolean(n))
      .map(n => getNodeLabel(n))
      .join('和')
    const fn = funcName ? `${funcName}` : '特定逻辑'
    return deps
      ? `用 ${fn} 评估下 ${deps}，判定 ${label} 为 ${value}`
      : `走了一遍 ${fn}，得出 ${label} 为 ${value}`
  }

  const incoming = edges.filter(e => e.target === node.id)
  if (!incoming.length) return `${label} 为 ${value}`

  const opNode = nodes.find(n => n.id === incoming[0].source)
  if (!opNode || opNode.type !== 'operatorNode') return `${label} 为 ${value}`

  const op  = opNode.data.operator
  const opIncoming = edges.filter(e => e.target === opNode.id)
  const leftLit  = opNode.data.literalOperands.find(l => l.side === 'left')
  const rightLit = opNode.data.literalOperands.find(l => l.side === 'right')

  // SUM of many named terms
  if (op === '+' && opNode.data.sumTerms && opNode.data.sumTerms.length >= 2) {
    const terms = opNode.data.sumTerms
      .map(tid => nodes.find(n => n.id === tid))
      .filter((n): n is FlowNode => Boolean(n))
    const termStr = terms.map(n => `${getNodeLabel(n)} (${fmtV(n, ds)})`).join('、')
    return `把 ${termStr} 拢到一块加起来，共 ${label} (${value})`
  }

  // Binary operator — resolve left / right sources
  const leftSrcId  = opIncoming[0]?.source
  const rightSrcId = opIncoming[1]?.source
  const leftNode   = leftSrcId  ? nodes.find(n => n.id === leftSrcId)  : null
  const rightNode  = rightSrcId ? nodes.find(n => n.id === rightSrcId) : null

  function getOperandText(n: FlowNode | null | undefined, lit: typeof leftLit | undefined) {
    if (n?.type === 'cellNode') return `${getNodeLabel(n)} (${fmtV(n, ds)})`
    if (lit) return formatNarrationValue(lit.value, lit.isPercent, ds.numberDecimals, ds.percentMode, ds.percentDecimals)
    return null
  }

  const leftText = getOperandText(leftNode, leftLit)
  const rightText = getOperandText(rightNode, rightLit)

  const rightIsPercent = Boolean(
    (rightNode?.type === 'cellNode' ? rightNode.data.isPercent : rightLit?.isPercent) && ds.percentMode,
  )
  const leftIsPercent = Boolean(
    (leftNode?.type === 'cellNode' ? leftNode.data.isPercent : leftLit?.isPercent) && ds.percentMode,
  )

  if (!leftText && !rightText) return `${label} 为 ${value}`

  const isTaxOrFee = (text: string) => /[税费金额]/.test(text)
  const rateWord = (text: string) => isTaxOrFee(text) ? '计提' : '推算'

  // Hash to pick phrases
  const h = (str: string) => { let s=0; for(let i=0;i<str.length;i++) s+=str.charCodeAt(i); return s; }
  const randomPick = (opts: string[]) => opts[h(node.id) % opts.length]

  switch (op) {
    case '+':
      if (leftText && rightText) {
         return randomPick([
           `把 ${leftText} 和 ${rightText} 加起来，得 ${label} (${value})`,
           `${leftText} 加上 ${rightText}，就是 ${label} (${value})`,
           `${leftText} 加 ${rightText}，得出 ${label} (${value})`
         ])
      }
      return `加上 ${leftText ?? rightText}，是 ${label} (${value})`
    case '-':
      if (leftText && rightText) {
          return randomPick([
             `从 ${leftText} 扣掉 ${rightText}，剩 ${label} (${value})`,
             `${leftText} 减去 ${rightText}，得出 ${label} (${value})`,
             `拿 ${leftText} 剔除 ${rightText}，即 ${label} (${value})`
          ])
      }
      return `${label} 为 ${value}`
    case '*':
      if (rightIsPercent && leftText && rightText) {
          return randomPick([
             `按 ${rightText} 提取 ${leftText}，即 ${label} (${value})`,
             `${leftText} 乘其 ${rightText} 的比例，算出 ${label} (${value})`
          ])
      }
      if (leftIsPercent && rightText && leftText) return `${rightText} 按 ${leftText} 折算，得 ${label} (${value})`
      if (leftText && rightText) return `${leftText} 乘上 ${rightText}，算得 ${label} (${value})`
      return `${label} 为 ${value}`
    case '/':
      if (rightIsPercent && leftText && rightText) return `${leftText} 凭 ${rightText} 还原为 ${label} (${value})`
      if (leftText && rightText) return `${leftText} 按 ${rightText} 摊分，得 ${label} (${value})`
      return `${label} 是 ${value}`
    default:
      return `${label} 是 ${value}`
  }
}

/**
 * Assemble activated cell nodes into one cohesive natural-language paragraph.
 * Mimics how a person would walk through a calculation chain in a verbal report.
 */
function buildNaturalParagraph(
  cells: FlowNode[],
  nodes: FlowNode[],
  edges: FlowEdge[],
  ds: DS,
): string {
  if (!cells.length) return ''

  const inputCells = cells.filter(n => isInputCell(n, edges))
  const calcCells  = cells.filter(n => !isInputCell(n, edges))

  const sentences: string[] = []

  // ── Opening: state the raw input values ───────────────────────────────────
  if (inputCells.length === 1) {
    const n = inputCells[0]
    sentences.push(`基础数据是 ${getNodeLabel(n)} (${fmtV(n, ds)})`)
  } else if (inputCells.length > 1) {
    const items = inputCells.map(n => `${getNodeLabel(n)} (${fmtV(n, ds)})`)
    sentences.push(`原始数据有：${items.join('，')}`)
  }

  const getHash = (id: string, max: number) => {
    let h = 0; for(let i=0; i<id.length; i++) h += id.charCodeAt(i);
    return h % max;
  }

  // ── Calculation sentences with natural transitions ─────────────────────────
  calcCells.forEach((n, i) => {
    const isOutputNode = Boolean((n.data as { isOutput?: boolean }).isOutput)
    const desc = buildCalcDesc(n, nodes, edges, ds)
    const h = getHash(n.id, 100)
    
    // Check if it has multiple dependencies (e.g. joining branches or SUM)
    let isMerge = false;
    const incomingEdges = edges.filter(e => e.target === n.id)
    if (n.data.isComplex && incomingEdges.length > 1) {
      isMerge = true;
    } else if (incomingEdges.length === 1) {
      const opNode = nodes.find(op => op.id === incomingEdges[0].source)
      if (opNode && opNode.type === 'operatorNode') {
         const opIncoming = edges.filter(e => e.target === opNode.id)
         if (opIncoming.length > 1 || (opNode.data.sumTerms && opNode.data.sumTerms.length >= 2)) {
           isMerge = true;
         }
      }
    }

    if (isOutputNode && i === calcCells.length - 1) {
      sentences.push(`最后，${desc}，这就是最终结果`)
    } else if (i === 0) {
      sentences.push(inputCells.length > 0 ? `有了这些，我们先${desc}` : `我们先${desc}`)
    } else {
      let prefix = ""
      if (isMerge) {
        const merges = ['汇总上面的分支，', '结合各条线，', '整合前面数据后，']
        prefix = merges[h % merges.length]
      } else {
        const trans = ['紧接着，', '那顺势，', '再走下一步，', '']
        prefix = h < 40 ? trans[h % trans.length] : '' 
      }
      sentences.push(`${prefix}${desc}`)
    }
  })

  return sentences.map(s => s + '。').join('').replace(/。。/g, '。')
}


/**
 * Programmatically fits the viewport to the nodes visible at the current
 * globalLevel whenever the graph or level changes.
 */
function FlowAutoFit() {
  const { fitView } = useReactFlow()
  const hasMainPath     = useFlowStore(s => s.hasMainPath)
  const mainPathNodeIds = useFlowStore(s => s.mainPathNodeIds)
  const storeNodes      = useFlowStore(s => s.nodes)
  const focusMainPath   = useFlowStore(s => s.focusMainPath)
  const globalLevel     = useFlowStore(s => s.globalLevel)
  const levelNodeIds    = useFlowStore(s => s.levelNodeIds)
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayedNodes = storeNodes

  useEffect(() => {
    if (displayedNodes.length === 0) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      if (focusMainPath) {
        const targetIds = levelNodeIds[globalLevel] ?? mainPathNodeIds
        const visibleIds = [...targetIds].filter(id => displayedNodes.some(n => (n as any).id === id))
        fitView({
          padding: 0.12,
          nodes: visibleIds.map(id => ({ id })),
          maxZoom: 1.4,
          duration: 500,
        })
      } else if (hasMainPath && mainPathNodeIds.size > 0) {
        fitView({
          padding: 0.10,
          nodes: [...mainPathNodeIds].map(id => ({ id })),
          maxZoom: 1.4,
          duration: 550,
        })
      } else {
        fitView({ padding: 0.12, maxZoom: 1.2, duration: 550 })
      }
    }, 80)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [displayedNodes, hasMainPath, mainPathNodeIds, focusMainPath, globalLevel, levelNodeIds, fitView])

  return null
}


function PlaybackNarration() {
  const {
    animationStatus, animationStep, animationSteps,
    nodes, edges, displaySettings,
    mainPathNodeIds, hasMainPath,
  } = useFlowStore()

  const visibleStepCount =
    animationStatus === 'done' ? animationSteps.length :
    animationStatus === 'idle' ? 0 : animationStep

  // Collect activated cell nodes in step order, main-path only
  const activatedCells = animationSteps
    .slice(0, visibleStepCount)
    .flatMap(step => step.nodeIds)
    .map(id => nodes.find(n => n.id === id))
    .filter((n): n is FlowNode => typeof n !== 'undefined' && n.type === 'cellNode')
    .filter(n => !hasMainPath || mainPathNodeIds.has(n.id))

  const paragraph = buildNaturalParagraph(activatedCells, nodes, edges, displaySettings)

  let title = '计算解说'
  let dotColor = 'bg-slate-400'
  if (animationStatus === 'playing') { title = '计算进行中'; dotColor = 'bg-emerald-400 animate-pulse' }
  else if (animationStatus === 'paused') { title = '已暂停'; dotColor = 'bg-amber-400' }
  else if (animationStatus === 'done')   { title = '计算完成'; dotColor = 'bg-sky-400' }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[min(820px,calc(100%-11rem))] rounded-2xl border border-neutral-200/70 bg-white/95 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.06)] px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-400 font-bold">{title}</p>
      </div>

      {paragraph ? (
        <p className="text-[14px] leading-[1.8] text-neutral-700 whitespace-normal break-words">
          {paragraph}
        </p>
      ) : (
        <p className="text-[13px] leading-6 text-neutral-400">
          点击播放，我来解说计算过程
        </p>
      )}
    </div>
  )
}

function LegendPanel() {
  const [isOpen, setIsOpen] = useState(true)

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="absolute top-4 left-4 z-10 bg-lpf-surface/90 backdrop-blur-sm border border-lpf-border rounded-xl p-2 hover:bg-lpf-card transition-colors shadow-sm"
        title="展开配置面板"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-lpf-subtle"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
      </button>
    )
  }

  return (
    <div className="absolute top-4 left-4 z-10 bg-lpf-surface/90 backdrop-blur-sm border border-lpf-border rounded-xl px-3 py-2.5 min-w-[140px] shadow-sm transition-all">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] text-lpf-subtle uppercase tracking-widest font-medium">配置与图例</p>
        <button onClick={() => setIsOpen(false)} className="text-lpf-muted hover:text-lpf-text p-0.5 -mr-1 rounded hover:bg-lpf-border">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-sm tracking-[0.13em] font-bold border leading-none bg-purple-100 text-purple-600 border-purple-200">
            起点
          </span>
          <span className="text-[11px] text-lpf-muted">推导基准点</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-sm tracking-[0.13em] font-bold border leading-none bg-purple-100 text-purple-600 border-purple-200">
            终点
          </span>
          <span className="text-[11px] text-lpf-muted">最终计算结果</span>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <div className="shrink-0 flex items-center justify-center w-7 h-3 rounded-sm border border-slate-200 bg-slate-50">
             <div className="w-5 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500" />
          </div>
          <span className="text-[11px] text-lpf-muted">敏感性权重指示</span>
        </div>
      </div>

          <DisplayPanel />
    </div>
  )
}

// ── Global Level Control ────────────────────────────────────────────────────

function GlobalLevelControl() {
  const focusMainPath = useFlowStore(s => s.focusMainPath)
  const globalLevel   = useFlowStore(s => s.globalLevel)
  const setGlobalLevel = useFlowStore(s => s.setGlobalLevel)

  if (!focusMainPath) return null

  const labels: Record<GlobalLevel, string> = {
    1: '核心路径',
    2: '扩展关联',
    3: '全局视图',
  }

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-md border border-neutral-200 rounded-2xl px-2 py-1.5 shadow-lg shadow-black/8">
      {([1, 2, 3] as GlobalLevel[]).map(level => (
        <button
          key={level}
          onClick={() => setGlobalLevel(level)}
          className={[
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200',
            globalLevel === level
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100',
          ].join(' ')}
        >
          <span className={[
            'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold border',
            globalLevel === level ? 'border-white/30 text-white' : 'border-neutral-300 text-neutral-500',
          ].join(' ')}>{level}</span>
          {labels[level]}
        </button>
      ))}
    </div>
  )
}

// ── Level Boundary Boxes ────────────────────────────────────────────────────
// Must be placed as a child of <ReactFlow> to access the RF context

function LevelBoundaryBoxes() {
  const focusMainPath = useFlowStore(s => s.focusMainPath)
  const globalLevel   = useFlowStore(s => s.globalLevel)
  const levelNodeIds  = useFlowStore(s => s.levelNodeIds)
  const storeNodes    = useFlowStore(s => s.nodes)

  // Read the viewport transform directly from the ReactFlow store [x, y, zoom]
  const transform = useRFStore(s => s.transform)
  const [vpX, vpY, vpZoom] = transform

  if (!focusMainPath) return null

  function getBBox(nodeIds: Set<string>) {
    const ns = storeNodes.filter(n => nodeIds.has((n as any).id))
    if (ns.length === 0) return null
    const pad = 72
    const minX = Math.min(...ns.map(n => n.position.x)) - pad
    const minY = Math.min(...ns.map(n => n.position.y)) - pad
    const maxX = Math.max(...ns.map(n => n.position.x + ((n as any).width ?? 180))) + pad
    const maxY = Math.max(...ns.map(n => n.position.y + ((n as any).height ?? 60))) + pad
    const sx = minX * vpZoom + vpX
    const sy = minY * vpZoom + vpY
    const sw = (maxX - minX) * vpZoom
    const sh = (maxY - minY) * vpZoom
    return { sx, sy, sw, sh }
  }

  const boxes: { level: GlobalLevel; color: string; dash: string; label: string }[] = [
    { level: 1, color: '#6b7280', dash: '6 4',  label: '核心路径' },
    { level: 2, color: '#a78bfa', dash: '8 4',  label: '扩展关联' },
    { level: 3, color: '#c4b5fd', dash: '10 6', label: '全局视图' },
  ]

  return (
    <Panel position="top-left" style={{ width: '100%', height: '100%', pointerEvents: 'none', margin: 0, padding: 0 }}>
      <svg width="100%" height="100%" style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
        {boxes.map(({ level, color, dash, label }) => {
          if (level > globalLevel) return null
          const bbox = getBBox(levelNodeIds[level])
          if (!bbox) return null
          const { sx, sy, sw, sh } = bbox
          return (
            <g key={level}>
              <rect
                x={sx} y={sy} width={sw} height={sh}
                fill="none" stroke={color}
                strokeWidth={level === globalLevel ? 1.5 : 1}
                strokeDasharray={dash}
                strokeOpacity={level === globalLevel ? 0.7 : 0.35}
                rx={8}
              />
              <text x={sx + 10} y={sy - 6} fontSize={10} fill={color}
                opacity={level === globalLevel ? 0.8 : 0.4} fontFamily="monospace">
                ⌗ {level}档 · {label}
              </text>
            </g>
          )
        })}
      </svg>
    </Panel>
  )
}

export function FlowCanvas() {
  const storeNodes     = useFlowStore(s => s.nodes)
  const storeEdges     = useFlowStore(s => s.edges)
  const focusMainPath  = useFlowStore(s => s.focusMainPath)
  const globalLevel    = useFlowStore(s => s.globalLevel)
  const levelNodeIds   = useFlowStore(s => s.levelNodeIds)

  // Apply hidden=true to nodes outside current level when in focus mode
  const displayNodes = useMemo(() => {
    if (!focusMainPath) return storeNodes
    const visible = levelNodeIds[globalLevel]
    return storeNodes.map(n => ({
      ...n,
      hidden: !visible.has((n as any).id),
    }))
  }, [storeNodes, focusMainPath, globalLevel, levelNodeIds])

  // Hide edges whose source or target is hidden
  const displayEdges = useMemo(() => {
    if (!focusMainPath) return storeEdges
    const visible = levelNodeIds[globalLevel]
    return storeEdges.map(e => ({
      ...e,
      hidden: !visible.has((e as any).source) || !visible.has((e as any).target),
    }))
  }, [storeEdges, focusMainPath, globalLevel, levelNodeIds])

  const [nodes, setNodes, onNodesChange] = useNodesState(displayNodes as any)
  const [edges, setEdges, onEdgesChange] = useEdgesState(displayEdges as any)

  useEffect(() => { setNodes(displayNodes as any) }, [displayNodes, setNodes])
  useEffect(() => { setEdges(displayEdges as any) }, [displayEdges, setEdges])

  useEffect(() => {
    // Stage 1: Unfocused graph loads and rests for 1s
    const t1 = setTimeout(() => {
      const { focusMainPath, toggleFocusMainPath, mainPathNodeIds, setIntroState } = useFlowStore.getState()
      
      if (!focusMainPath && mainPathNodeIds.size > 0) {
        toggleFocusMainPath()
        setIntroState('moving_cards')
        
        // Stage 2: Cards move for 1.0s
        const t2 = setTimeout(() => {
          setIntroState('connecting_edges')

          // Stage 3: Edges draw for 1.0s
          const t3 = setTimeout(() => {
            setIntroState('done')
          }, 1000)
          
          return () => clearTimeout(t3)
        }, 1000)

        // Store intermediate timeout cleanup just in case component unmounts early?
        // Let's just avoid memory leaks by letting timeouts run if unmounted since `useFlowStore.getState()` is pure, 
        // but react unmount might complain. It's safe given it's global zustand state.
      }
    }, 1000)
    return () => clearTimeout(t1)
  }, [])

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.05}
        maxZoom={3}
        proOptions={{ hideAttribution: false }}
        nodesDraggable
        panOnScroll
        zoomOnScroll
        snapToGrid
        snapGrid={[28, 28]}
      >
        <FlowAutoFit />
        <Background
          id="grid-lines"
          variant={BackgroundVariant.Lines}
          gap={28}
          size={1}
          color="#dddddd"
          style={{ background: '#efefef', opacity: 0.38 }}
        />
        <Background
          id="grid-dots"
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1.8}
          color="#c3c3c3"
          style={{ background: 'transparent' }}
        />
        <Controls position="bottom-right" style={{ bottom: '80px' }} />
        <MiniMap
          position="top-right"
          nodeColor={(node) => {
            if (node.type === 'chainNode') return '#8b5cf6'
            if (node.type === 'sumClusterNode') return '#38bdf8'
            if (node.type === 'valueDuplicateNode') return '#fbbf24'
            if (node.type === 'arithmeticGroupNode') return '#34d399'
            if (node.type === 'operatorNode') return '#6b7280'
            if (node.type === 'constantNode') return '#b45309'
            return '#9ca3af'
          }}
          maskColor="rgba(0,0,0,0.12)"
          style={{ background: '#f5f5f5', border: '1px solid #d8d8d8', borderRadius: 10 }}
        />
        <LevelBoundaryBoxes />
      </ReactFlow>

      <PlaybackNarration />

      <LegendPanel />

      <GlobalLevelControl />

      <AnimationBar />
    </div>
  )
}
