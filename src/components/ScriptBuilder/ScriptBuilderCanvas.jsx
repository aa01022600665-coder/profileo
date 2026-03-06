import React, { useCallback, useRef, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useReactFlow,
} from '@xyflow/react'
import TriggerNode from './nodes/TriggerNode'
import ActionNode from './nodes/ActionNode'
import LoopNode from './nodes/LoopNode'
import { NODE_CONFIG_SCHEMAS, getCategoryColor, getDefaultConfig } from './nodeConfigs'

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { stroke: '#4285f4', strokeWidth: 2 },
}

function ScriptBuilderCanvas({ nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges, onNodeSelect }) {
  const reactFlowWrapper = useRef(null)
  const reactFlowInstance = useReactFlow()

  const nodeTypes = useMemo(() => ({
    triggerNode: TriggerNode,
    actionNode: ActionNode,
    loopNode: LoopNode,
  }), [])

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: '#4285f4', strokeWidth: 2 } }, eds))
  }, [setEdges])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const dataStr = event.dataTransfer.getData('application/reactflow')
    if (!dataStr) return

    const { actionType } = JSON.parse(dataStr)
    const schema = NODE_CONFIG_SCHEMAS[actionType]
    if (!schema) return

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const isLoop = actionType === 'loop' || actionType === 'repeatBlock'
    const newNode = {
      id: `node-${Date.now()}`,
      type: isLoop ? 'loopNode' : 'actionNode',
      position,
      data: {
        actionType,
        label: schema.label,
        icon: schema.icon,
        categoryColor: getCategoryColor(actionType),
        config: getDefaultConfig(actionType),
      },
    }

    setNodes((nds) => [...nds, newNode])
  }, [reactFlowInstance, setNodes])

  const onNodeClick = useCallback((_, node) => {
    onNodeSelect(node.id)
  }, [onNodeSelect])

  const onPaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  const onNodesDelete = useCallback((deleted) => {
    // Prevent trigger node deletion
    const triggerIds = deleted.filter(n => n.type === 'triggerNode').map(n => n.id)
    if (triggerIds.length > 0) {
      setNodes((nds) => [...nds, ...deleted.filter(n => n.type === 'triggerNode')])
    }
  }, [setNodes])

  return (
    <div className="sb-canvas" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodesDelete={onNodesDelete}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode={['Backspace', 'Delete']}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a2240" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'triggerNode') return '#2ecc71'
            if (node.type === 'loopNode') return '#9b59b6'
            return '#4285f4'
          }}
          maskColor="rgba(10, 14, 26, 0.7)"
        />
      </ReactFlow>
    </div>
  )
}

export default ScriptBuilderCanvas
