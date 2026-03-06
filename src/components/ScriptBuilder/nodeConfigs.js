// Action categories and their blocks for the sidebar
export const ACTION_CATEGORIES = [
  {
    id: 'variables',
    label: 'Variables',
    color: '#f1c40f',
    actions: [
      { type: 'setVariable', label: 'Set Variable' },
    ]
  },
  {
    id: 'browser',
    label: 'Browser',
    color: '#3498db',
    actions: [
      { type: 'navigate', label: 'New Tab / Navigate' },
      { type: 'wait', label: 'Wait' },
      { type: 'waitForNavigation', label: 'Wait Navigation' },
      { type: 'waitForSelector', label: 'Wait for Element' },
      { type: 'goBack', label: 'Go Back' },
      { type: 'closeTab', label: 'Close Tab' },
      { type: 'reloadTab', label: 'Reload Tab' },
    ]
  },
  {
    id: 'interaction',
    label: 'Interaction',
    color: '#2ecc71',
    actions: [
      { type: 'click', label: 'Click Element' },
      { type: 'type', label: 'Type Text' },
      { type: 'scroll', label: 'Scroll' },
      { type: 'scrollToElement', label: 'Scroll to Element' },
      { type: 'evaluate', label: 'JavaScript Code' },
      { type: 'keypress', label: 'Keypress' },
    ]
  },
  {
    id: 'condition',
    label: 'Condition',
    color: '#e67e22',
    actions: [
      { type: 'condition', label: 'Condition' },
    ]
  },
  {
    id: 'loops',
    label: 'Loops',
    color: '#9b59b6',
    actions: [
      { type: 'loop', label: 'Loop Data' },
      { type: 'repeatBlock', label: 'Repeat Block' },
      { type: 'stopLoop', label: 'Stop Loop' },
    ]
  },
]

// Get category color for an action type
export function getCategoryColor(actionType) {
  for (const cat of ACTION_CATEGORIES) {
    if (cat.actions.some(a => a.type === actionType)) return cat.color
  }
  return '#4285f4'
}

// Node configuration schemas — defines form fields per action type
export const NODE_CONFIG_SCHEMAS = {
  navigate: {
    label: 'Navigate / New Tab',
    icon: '🌐',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://www.example.com' },
    ]
  },
  click: {
    label: 'Click Element',
    icon: '🖱',
    fields: [
      { key: 'selector', label: 'CSS Selector', type: 'text', placeholder: '.btn, #submit, a.link' },
      { key: 'optional', label: 'Optional (skip if not found)', type: 'checkbox', default: false },
    ]
  },
  type: {
    label: 'Type Text',
    icon: '⌨',
    fields: [
      { key: 'selector', label: 'CSS Selector', type: 'text', placeholder: 'input.search, textarea' },
      { key: 'text', label: 'Text to Type', type: 'text', placeholder: 'Hello world' },
      { key: 'delay', label: 'Typing Delay (ms)', type: 'number', default: 50, min: 0, max: 500 },
    ]
  },
  wait: {
    label: 'Wait / Delay',
    icon: '⏱',
    fields: [
      { key: 'duration', label: 'Duration (sec, e.g. "3" or "3-5" for random)', type: 'text', default: '2-4' },
    ]
  },
  waitForNavigation: {
    label: 'Wait for Navigation',
    icon: '⏳',
    fields: [
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 15000 },
    ]
  },
  waitForSelector: {
    label: 'Wait for Element',
    icon: '👁',
    fields: [
      { key: 'selector', label: 'CSS Selector', type: 'text', placeholder: '.element-to-wait-for' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 10000 },
    ]
  },
  scroll: {
    label: 'Scroll Page',
    icon: '↕',
    fields: [
      { key: 'direction', label: 'Direction', type: 'select', options: ['down', 'up'], default: 'down' },
      { key: 'amount', label: 'Amount (pages)', type: 'number', default: 3, min: 1, max: 20 },
    ]
  },
  scrollToElement: {
    label: 'Scroll to Element',
    icon: '🎯',
    fields: [
      { key: 'selector', label: 'CSS Selector', type: 'text', placeholder: '.target-element' },
    ]
  },
  goBack: {
    label: 'Go Back',
    icon: '←',
    fields: []
  },
  closeTab: {
    label: 'Close Tab',
    icon: '✕',
    fields: []
  },
  reloadTab: {
    label: 'Reload Tab',
    icon: '↻',
    fields: []
  },
  evaluate: {
    label: 'JavaScript Code',
    icon: '{;}',
    fields: [
      { key: 'script', label: 'Code', type: 'textarea', placeholder: 'document.querySelector(...)' },
    ]
  },
  keypress: {
    label: 'Keypress',
    icon: '⎆',
    fields: [
      { key: 'key', label: 'Key', type: 'text', placeholder: 'Enter, Tab, Escape' },
    ]
  },
  loop: {
    label: 'Loop Data',
    icon: '🔄',
    fields: [
      { key: 'selector', label: 'Loop Selector', type: 'text', placeholder: '.item, li, tr' },
      { key: 'maxIterations', label: 'Max Iterations', type: 'text', default: '5' },
    ]
  },
  repeatBlock: {
    label: 'Repeat Block',
    icon: '🔁',
    fields: [
      { key: 'count', label: 'Repeat Count', type: 'text', default: '3' },
    ]
  },
  stopLoop: {
    label: 'Stop Loop',
    icon: '⛔',
    fields: []
  },
  condition: {
    label: 'Condition',
    icon: '❓',
    fields: [
      { key: 'selector', label: 'Check Element Exists (CSS)', type: 'text', placeholder: '.success-msg' },
    ]
  },
  setVariable: {
    label: 'Set Variable',
    icon: 'X=',
    fields: [
      { key: 'varName', label: 'Variable Name', type: 'text', placeholder: 'myVar' },
      { key: 'value', label: 'Value', type: 'text', placeholder: 'some value or {{param}}' },
    ]
  },
}

// Get default config values for an action type
export function getDefaultConfig(actionType) {
  const schema = NODE_CONFIG_SCHEMAS[actionType]
  if (!schema) return {}
  const config = {}
  schema.fields.forEach(f => {
    if (f.default !== undefined) config[f.key] = f.default
    else config[f.key] = f.type === 'checkbox' ? false : ''
  })
  return config
}

// Get a summary string for a node (shown below the label)
export function getNodeSummary(actionType, config) {
  if (!config) return ''
  switch (actionType) {
    case 'navigate': return config.url ? config.url.substring(0, 35) + (config.url.length > 35 ? '...' : '') : ''
    case 'click': return config.selector || ''
    case 'type': return config.text ? `"${config.text.substring(0, 25)}"` : ''
    case 'wait': return config.duration ? `${config.duration}s` : ''
    case 'waitForSelector': return config.selector || ''
    case 'scroll': return `${config.direction || 'down'} × ${config.amount || 3}`
    case 'scrollToElement': return config.selector || ''
    case 'evaluate': return config.script ? config.script.substring(0, 30) + '...' : ''
    case 'keypress': return config.key || ''
    case 'loop': return config.selector ? `${config.selector} (×${config.maxIterations || '?'})` : ''
    case 'repeatBlock': return `×${config.count || '?'}`
    case 'condition': return config.selector || ''
    case 'setVariable': return config.varName ? `${config.varName} = ${config.value || ''}` : ''
    default: return ''
  }
}

// Platform options
export const PLATFORMS = ['YouTube', 'Twitch', 'Kick', 'Amazon', 'eBay', 'Facebook', 'Google', 'Instagram', 'TikTok', 'X', 'Other']
