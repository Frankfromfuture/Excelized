import { useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ChevronUp, ChevronDown } from 'lucide-react'

import { CellNode }     from '../nodes/CellNode'
import { OperatorNode } from '../nodes/OperatorNode'
import { ConstantNode } from '../nodes/ConstantNode'
import { AnimatedEdge } from '../edges/AnimatedEdge'
import { AnimationBar } from '../AnimationBar/AnimationBar'
import { useFlowStore } from '../../store/flowStore'

const nodeTypes: NodeTypes = {
  cellNode:     CellNode as any,
  operatorNode: OperatorNode as any,
  constantNode: ConstantNode as any,
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

export function FlowCanvas() {
  const storeNodes = useFlowStore(s => s.nodes)
  const storeEdges = useFlowStore(s => s.edges)

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes as any)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges as any)

  useEffect(() => { setNodes(storeNodes as any) }, [storeNodes, setNodes])
  useEffect(() => { setEdges(storeEdges as any) }, [storeEdges, setEdges])

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: false }}
        nodesDraggable
        panOnScroll
        zoomOnScroll
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="#1e1e1e"
          style={{ background: '#080808' }}
        />
        <Controls position="bottom-right" style={{ bottom: '80px' }} />
        <MiniMap
          position="top-right"
          nodeColor={(node) => {
            if (node.type === 'operatorNode') return '#444'
            if (node.type === 'constantNode') return '#78350f'
            return '#2a2a2a'
          }}
          maskColor="rgba(0,0,0,0.55)"
          style={{ background: '#111', border: '1px solid #262626', borderRadius: 10 }}
        />
      </ReactFlow>

      {/* Left panel: legend + display settings */}
      <div className="absolute top-4 left-4 z-10 bg-lpf-surface/90 backdrop-blur-sm border border-lpf-border rounded-xl px-3 py-2.5 min-w-[130px]">
        <p className="text-[9px] text-lpf-subtle uppercase tracking-widest mb-2 font-medium">运算类型</p>
        {LEGEND.map(({ op, color, label }) => (
          <div key={op} className="flex items-center gap-2 mb-1 last:mb-0">
            <div className="flex items-center gap-1">
              <div className="w-7 border-t border-dashed opacity-70" style={{ borderColor: color }} />
              <span className="w-4 h-4 rounded-sm flex items-center justify-center text-[10px] font-bold border"
                style={{ color, borderColor: `${color}60`, background: `${color}12` }}>
                {op === '*' ? '×' : op === '/' ? '÷' : op}
              </span>
            </div>
            <span className="text-[11px] text-lpf-muted">{label}</span>
          </div>
        ))}
        <DisplayPanel />
      </div>

      <AnimationBar />
    </div>
  )
}
