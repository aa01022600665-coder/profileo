import { NODE_CONFIG_SCHEMAS, getCategoryColor, getDefaultConfig } from './nodeConfigs'

// Convert a node to a script step
function nodeToStep(node) {
  const { actionType, config } = node.data
  if (!config) return null

  switch (actionType) {
    case 'navigate': return { action: 'navigate', url: config.url || '' }
    case 'click': return { action: 'click', selector: config.selector || '', ...(config.optional ? { optional: true } : {}) }
    case 'type': return { action: 'type', selector: config.selector || '', text: config.text || '', delay: config.delay || 50 }
    case 'wait': return { action: 'wait', duration: config.duration || '2' }
    case 'waitForNavigation': return { action: 'waitForNavigation', ...(config.timeout ? { timeout: config.timeout } : {}) }
    case 'waitForSelector': return { action: 'waitForSelector', selector: config.selector || '', ...(config.timeout ? { timeout: config.timeout } : {}) }
    case 'scroll': return { action: 'scroll', direction: config.direction || 'down', amount: config.amount || 3 }
    case 'scrollToElement': return { action: 'scrollToElement', selector: config.selector || '' }
    case 'goBack': return { action: 'goBack' }
    case 'closeTab': return { action: 'closeTab' }
    case 'reloadTab': return { action: 'reloadTab' }
    case 'evaluate': return { action: 'evaluate', script: config.script || '' }
    case 'clickText': return { action: 'clickText', text: config.text || '', ...(config.optional ? { optional: true } : {}) }
    case 'keypress': return { action: 'keypress', key: config.key || '' }
    case 'loop': return { action: 'loop', selector: config.selector || '', maxIterations: config.maxIterations || '5', steps: config.childSteps || [] }
    case 'repeatBlock': return { action: 'repeatBlock', count: config.count || '1', steps: config.childSteps || [] }
    case 'stopLoop': return { action: 'stopLoop' }
    case 'condition': return { action: 'condition', selector: config.selector || '' }
    case 'setVariable': return { action: 'setVariable', varName: config.varName || '', value: config.value || '' }
    default: return null
  }
}

// Extract {{param}} patterns from steps to generate params array
function extractParams(steps) {
  const paramSet = new Map()
  const paramRegex = /\{\{(\w+)\}\}/g

  function scanValue(val) {
    if (typeof val !== 'string') return
    let match
    while ((match = paramRegex.exec(val)) !== null) {
      const key = match[1]
      if (!paramSet.has(key)) {
        paramSet.set(key, {
          key,
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
          type: 'text',
          default: '',
        })
      }
    }
  }

  function scanStep(step) {
    Object.values(step).forEach(v => {
      if (typeof v === 'string') scanValue(v)
      else if (Array.isArray(v)) v.forEach(s => { if (typeof s === 'object') scanStep(s) })
    })
  }

  steps.forEach(scanStep)
  return Array.from(paramSet.values())
}

// Serialize nodes + edges to script object
export function serialize(nodes, edges, meta) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const edgesBySource = new Map()
  edges.forEach(e => {
    if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, [])
    edgesBySource.get(e.source).push(e)
  })

  // Find trigger node
  const triggerNode = nodes.find(n => n.type === 'triggerNode')
  if (!triggerNode) return null

  // Walk from trigger following edges
  const steps = []
  let currentId = triggerNode.id
  const visited = new Set()

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const outEdges = edgesBySource.get(currentId) || []
    if (outEdges.length === 0) break

    const nextEdge = outEdges[0]
    const nextNode = nodeMap.get(nextEdge.target)
    if (!nextNode) break

    const step = nodeToStep(nextNode)
    if (step) steps.push(step)
    currentId = nextNode.id
  }

  const params = extractParams(steps)

  return {
    id: meta.id || `user-script-${Date.now()}`,
    platform: meta.platform || 'Other',
    name: meta.name || 'Untitled Script',
    description: meta.description || '',
    price: 'Custom',
    type: 'user',
    tags: meta.tags || '',
    params,
    steps,
    visualData: {
      nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data, deletable: n.deletable })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type, animated: e.animated })),
    },
    createdAt: meta.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Deserialize script object to nodes + edges
export function deserialize(script) {
  // If visualData exists, use it directly (preserves positions)
  if (script.visualData && script.visualData.nodes && script.visualData.nodes.length > 0) {
    return {
      nodes: script.visualData.nodes,
      edges: script.visualData.edges || [],
      meta: {
        id: script.id,
        name: script.name,
        description: script.description || '',
        platform: script.platform || 'Other',
        tags: script.tags || '',
        createdAt: script.createdAt,
      }
    }
  }

  // Otherwise reconstruct from steps array
  const nodes = []
  const edges = []
  const X_START = 100
  const Y_CENTER = 250
  const X_SPACING = 280

  // Trigger node
  nodes.push({
    id: 'trigger-1',
    type: 'triggerNode',
    position: { x: X_START, y: Y_CENTER },
    data: { label: 'Trigger' },
    deletable: false,
  })

  let prevId = 'trigger-1'

  script.steps.forEach((step, index) => {
    const nodeId = `node-${index}`
    const actionType = step.action
    const schema = NODE_CONFIG_SCHEMAS[actionType]

    // Build config from step properties
    const config = { ...step }
    delete config.action

    const nodeType = (actionType === 'loop' || actionType === 'repeatBlock') ? 'loopNode' : 'actionNode'

    nodes.push({
      id: nodeId,
      type: nodeType,
      position: { x: X_START + (index + 1) * X_SPACING, y: Y_CENTER },
      data: {
        actionType,
        label: schema ? schema.label : actionType,
        icon: schema ? schema.icon : '?',
        categoryColor: getCategoryColor(actionType),
        config,
      },
    })

    edges.push({
      id: `edge-${prevId}-${nodeId}`,
      source: prevId,
      target: nodeId,
      type: 'smoothstep',
      animated: true,
    })

    prevId = nodeId
  })

  return {
    nodes,
    edges,
    meta: {
      id: script.id,
      name: script.name,
      description: script.description || '',
      platform: script.platform || 'Other',
      tags: script.tags || '',
      createdAt: script.createdAt,
    }
  }
}
