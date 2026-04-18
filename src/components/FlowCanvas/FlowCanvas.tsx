import { useEffect } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { BranchNode } from '../nodes/BranchNode'
import { CellNode } from '../nodes/CellNode'
import { OperatorNode } from '../nodes/OperatorNode'
import { AnimatedEdge } from '../edges/AnimatedEdge'
import { useFlowStore } from '../../store/flowStore'

const nodeTypes: NodeTypes = {
  branchNode: BranchNode as never,
  cellNode: CellNode as never,
  operatorNode: OperatorNode as never,
}

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge as never,
}

export function FlowCanvas() {
  const storeNodes = useFlowStore((state) => state.nodes)
  const storeEdges = useFlowStore((state) => state.edges)

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges)

  useEffect(() => {
    setNodes(storeNodes)
  }, [setNodes, storeNodes])

  useEffect(() => {
    setEdges(storeEdges)
  }, [setEdges, storeEdges])

  return (
    <div className="relative h-full w-full bg-neutral-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable
        nodesConnectable={false}
        panOnScroll
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={24} />
        <Controls position="bottom-right" />
        <MiniMap
          position="top-right"
          nodeColor={(node) => {
            if (node.type === 'branchNode') return '#f59e0b'
            if (node.type === 'operatorNode') return '#94a3b8'
            return '#cbd5e1'
          }}
          maskColor="rgba(248, 250, 252, 0.75)"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
          }}
        />
      </ReactFlow>

      {storeNodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/85 px-6 py-4 text-center shadow-sm">
            <p className="text-sm font-medium text-neutral-700">画布已就绪</p>
            <p className="mt-1 text-xs text-neutral-500">Phase 0 保留基础 React Flow 骨架，后续在 Phase 1 接入编辑模式。</p>
          </div>
        </div>
      )}
    </div>
  )
}
