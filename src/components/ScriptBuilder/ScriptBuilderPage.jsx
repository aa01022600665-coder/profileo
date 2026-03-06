import React, { useState, useEffect, useCallback } from 'react'
import { ReactFlowProvider, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import ScriptBuilderTopBar from './ScriptBuilderTopBar'
import ScriptBuilderSidebar from './ScriptBuilderSidebar'
import ScriptBuilderCanvas from './ScriptBuilderCanvas'
import NodeConfigPanel from './NodeConfigPanel'
import { serialize, deserialize } from './scriptSerializer'

const INITIAL_NODES = [
  {
    id: 'trigger-1',
    type: 'triggerNode',
    position: { x: 100, y: 250 },
    data: { label: 'Trigger' },
    deletable: false,
  }
]

function ScriptBuilderInner({ scriptId, onClose }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [scriptMeta, setScriptMeta] = useState({
    id: null,
    name: '',
    description: '',
    platform: 'Other',
    tags: '',
    createdAt: null,
  })
  const [isSaving, setIsSaving] = useState(false)

  // Load existing script if editing
  useEffect(() => {
    if (scriptId) {
      window.electronAPI.getUserScript(scriptId).then(script => {
        if (script) {
          const { nodes: loadedNodes, edges: loadedEdges, meta } = deserialize(script)
          setNodes(loadedNodes)
          setEdges(loadedEdges)
          setScriptMeta(meta)
        }
      }).catch(err => console.error('Load script error:', err))
    }
  }, [scriptId, setNodes, setEdges])

  // Get selected node object
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null

  // Update a node's config
  const handleUpdateConfig = useCallback((nodeId, newConfig) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: { ...n.data, config: newConfig },
          }
        }
        return n
      })
    )
  }, [setNodes])

  // Delete a node
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter(n => n.id !== nodeId))
    setEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    setSelectedNodeId(null)
  }, [setNodes, setEdges])

  // Save script
  const handleSave = useCallback(async () => {
    if (isSaving) return
    if (!scriptMeta.name || !scriptMeta.name.trim()) {
      alert('Please enter a script name')
      return
    }
    setIsSaving(true)

    try {
      const script = serialize(nodes, edges, scriptMeta)
      if (!script) {
        console.error('Failed to serialize script')
        setIsSaving(false)
        return
      }

      await window.electronAPI.saveUserScript(script)

      // After successful save, close builder and go back to Your Scripts
      setIsSaving(false)
      onClose()
      return
    } catch (err) {
      console.error('Save script error:', err)
    }

    setIsSaving(false)
  }, [nodes, edges, scriptMeta, isSaving, onClose])

  return (
    <div className="sb-container">
      <ScriptBuilderTopBar
        scriptMeta={scriptMeta}
        onMetaChange={setScriptMeta}
        onSave={handleSave}
        onClose={onClose}
        isSaving={isSaving}
      />

      <div className="sb-layout">
        <ScriptBuilderSidebar />

        <ScriptBuilderCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodeSelect={setSelectedNodeId}
        />

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdateConfig={handleUpdateConfig}
            onClose={() => setSelectedNodeId(null)}
            onDelete={handleDeleteNode}
          />
        )}
      </div>
    </div>
  )
}

function ScriptBuilderPage({ scriptId, onClose }) {
  return (
    <ReactFlowProvider>
      <ScriptBuilderInner scriptId={scriptId} onClose={onClose} />
    </ReactFlowProvider>
  )
}

export default ScriptBuilderPage
