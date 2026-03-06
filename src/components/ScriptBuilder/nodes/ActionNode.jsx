import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { getNodeSummary } from '../nodeConfigs'

function ActionNode({ data, selected }) {
  const summary = getNodeSummary(data.actionType, data.config)

  return (
    <div
      className={`sb-node sb-node-action ${selected ? 'sb-node-selected' : ''}`}
      style={{ borderLeftColor: data.categoryColor || '#4285f4' }}
    >
      <div className="sb-node-header">
        <span className="sb-node-icon">{data.icon || '⚡'}</span>
        <span className="sb-node-label">{data.label || data.actionType}</span>
      </div>
      {summary && <div className="sb-node-summary">{summary}</div>}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default ActionNode
