import React, { useState } from 'react'
import { ACTION_CATEGORIES, NODE_CONFIG_SCHEMAS } from './nodeConfigs'

function ScriptBuilderSidebar() {
  const [openCategories, setOpenCategories] = useState(
    ACTION_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {})
  )

  const toggleCategory = (id) => {
    setOpenCategories(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const onDragStart = (event, actionType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ actionType }))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="sb-sidebar">
      <div className="sb-sidebar-search">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" placeholder="Search..." className="sb-sidebar-search-input" />
      </div>

      {ACTION_CATEGORIES.map(cat => (
        <div key={cat.id} className="sb-category">
          <div className="sb-category-header" onClick={() => toggleCategory(cat.id)}>
            <span className="sb-category-dot" style={{ background: cat.color }} />
            <span>{cat.label}</span>
            <span className={`sb-category-chevron ${openCategories[cat.id] ? 'open' : ''}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </div>

          {openCategories[cat.id] && (
            <div className="sb-category-items">
              {cat.actions.map(action => {
                const schema = NODE_CONFIG_SCHEMAS[action.type]
                return (
                  <div
                    key={action.type}
                    className="sb-action-block"
                    draggable
                    onDragStart={(e) => onDragStart(e, action.type)}
                  >
                    <span className="sb-action-icon">{schema?.icon || '⚡'}</span>
                    <span>{action.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default ScriptBuilderSidebar
