import React from 'react'
import { NODE_CONFIG_SCHEMAS } from './nodeConfigs'

function NodeConfigPanel({ node, onUpdateConfig, onClose, onDelete }) {
  if (!node) return null

  const { actionType, config } = node.data
  const schema = NODE_CONFIG_SCHEMAS[actionType]

  if (!schema) {
    return (
      <div className="sb-config-panel">
        <div className="sb-config-header">
          <h3>Unknown Node</h3>
          <button className="sb-config-close" onClick={onClose}>&times;</button>
        </div>
      </div>
    )
  }

  const updateField = (key, value) => {
    onUpdateConfig(node.id, { ...config, [key]: value })
  }

  return (
    <div className="sb-config-panel">
      <div className="sb-config-header">
        <h3>
          <span style={{ marginRight: 6 }}>{schema.icon}</span>
          {schema.label}
        </h3>
        <button className="sb-config-close" onClick={onClose}>&times;</button>
      </div>

      <div className="sb-config-body">
        {schema.fields.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
            No configuration needed for this action.
          </div>
        )}

        {schema.fields.map(field => (
          <div key={field.key} className="form-group">
            <label>{field.label}</label>

            {field.type === 'text' && (
              <input
                type="text"
                className="np-input"
                placeholder={field.placeholder || ''}
                value={config?.[field.key] || ''}
                onChange={e => updateField(field.key, e.target.value)}
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                className="np-input"
                placeholder={field.placeholder || ''}
                value={config?.[field.key] ?? field.default ?? ''}
                min={field.min}
                max={field.max}
                onChange={e => updateField(field.key, parseInt(e.target.value) || 0)}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                className="np-input"
                placeholder={field.placeholder || ''}
                value={config?.[field.key] || ''}
                onChange={e => updateField(field.key, e.target.value)}
                rows={5}
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
              />
            )}

            {field.type === 'select' && (
              <select
                className="np-input"
                value={config?.[field.key] || field.default || ''}
                onChange={e => updateField(field.key, e.target.value)}
              >
                {(field.options || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={config?.[field.key] || false}
                  onChange={e => updateField(field.key, e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>{field.label}</span>
              </label>
            )}
          </div>
        ))}

        {node.type !== 'triggerNode' && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onDelete(node.id)}
              style={{ width: '100%' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: -1 }}>
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              Delete Node
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NodeConfigPanel
