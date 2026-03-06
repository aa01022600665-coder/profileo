import React from 'react'
import { Handle, Position } from '@xyflow/react'

function TriggerNode() {
  return (
    <div className="sb-node sb-node-trigger">
      <div className="sb-node-header">
        <span className="sb-node-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </span>
        <span className="sb-node-label">Trigger</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export default TriggerNode
