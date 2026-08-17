const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Profiles
  getProfiles: () => ipcRenderer.invoke('profiles:getAll'),
  createProfile: (profile) => ipcRenderer.invoke('profiles:create', profile),
  createProfilesBatch: (arr) => ipcRenderer.invoke('profiles:createBatch', arr),
  replaceAllFromCloud: (arr) => ipcRenderer.invoke('profiles:replaceAllFromCloud', arr),
  updateProfile: (id, data) => ipcRenderer.invoke('profiles:update', id, data),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  deleteMultipleProfiles: (ids) => ipcRenderer.invoke('profiles:deleteMultiple', ids),
  duplicateProfile: (id, count, options) => ipcRenderer.invoke('profiles:duplicate', id, count, options),
  launchProfile: (id) => ipcRenderer.invoke('profiles:launch', id),
  stopProfile: (id) => ipcRenderer.invoke('profiles:stop', id),
  listPhoneFarmDevices: () => ipcRenderer.invoke('phoneFarm:list'),
  getPhoneFarmScreenshot: (profileId) => ipcRenderer.invoke('phoneFarm:screenshot', profileId),
  tapPhoneFarmDevice: (profileId, point) => ipcRenderer.invoke('phoneFarm:tap', profileId, point),
  sendPhoneFarmKey: (profileId, key) => ipcRenderer.invoke('phoneFarm:key', profileId, key),
  launchPhoneFarmApp: (profileId, appName) => ipcRenderer.invoke('phoneFarm:launchApp', profileId, appName),
  onProfileStopped: (callback) => {
    const handler = (_, profileId) => callback(profileId)
    ipcRenderer.on('profile:stopped', handler)
    return () => ipcRenderer.removeListener('profile:stopped', handler)
  },

  // Folders
  getFolders: () => ipcRenderer.invoke('folders:getAll'),
  createFolder: (data) => ipcRenderer.invoke('folders:create', data),
  updateFolder: (id, data) => ipcRenderer.invoke('folders:update', id, data),
  deleteFolder: (id) => ipcRenderer.invoke('folders:delete', id),

  // Proxies
  getProxies: () => ipcRenderer.invoke('proxies:getAll'),
  addProxies: (data) => ipcRenderer.invoke('proxies:add', data),
  deleteProxy: (id) => ipcRenderer.invoke('proxies:delete', id),
  deleteMultipleProxies: (ids) => ipcRenderer.invoke('proxies:deleteMultiple', ids),

  // Automation
  getAutomationScripts: () => ipcRenderer.invoke('automation:getScripts'),
  runAutomationScript: (profileId, scriptId, params) => ipcRenderer.invoke('automation:runScript', profileId, scriptId, params),
  stopAutomationScript: (profileId) => ipcRenderer.invoke('automation:stopScript', profileId),
  getAutomationStatuses: () => ipcRenderer.invoke('automation:getStatuses'),
  selectAutomationTextFile: () => ipcRenderer.invoke('automation:selectTextFile'),
  getAutomationProfileState: (scriptId, profileId) => ipcRenderer.invoke('automation:getProfileState', scriptId, profileId),
  saveAutomationProfileState: (scriptId, profileId, data) => ipcRenderer.invoke('automation:saveProfileState', scriptId, profileId, data),
  onAutomationProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('automation:progress', handler)
    return () => ipcRenderer.removeListener('automation:progress', handler)
  },

  // User Scripts (custom scripts CRUD)
  getUserScripts: () => ipcRenderer.invoke('userScripts:getAll'),
  getUserScript: (id) => ipcRenderer.invoke('userScripts:get', id),
  saveUserScript: (script) => ipcRenderer.invoke('userScripts:save', script),
  deleteUserScript: (id) => ipcRenderer.invoke('userScripts:delete', id),

  // Billing
  getBillingPlan: (userId) => ipcRenderer.invoke('billing:getPlan', userId),
  saveBillingPlan: (userId, plan) => ipcRenderer.invoke('billing:savePlan', { userId, plan }),
  createPayment: (data) => ipcRenderer.invoke('billing:createPayment', data),
  getPaymentStatus: (paymentId) => ipcRenderer.invoke('billing:getPaymentStatus', paymentId),
  listPayments: () => ipcRenderer.invoke('billing:listPayments'),

  // Auth
  setAuthUser: (email) => ipcRenderer.invoke('auth:setUser', email),
  googleAuth: (clientId) => ipcRenderer.invoke('auth:google', clientId),
  sendVerificationCode: (email) => ipcRenderer.invoke('auth:sendCode', email),
  verifyCode: (email, code) => ipcRenderer.invoke('auth:verifyCode', email, code),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Updates
  getUpdateState: () => ipcRenderer.invoke('updates:getState'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateStatus: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('updates:status', handler)
    return () => ipcRenderer.removeListener('updates:status', handler)
  },

  // Window
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
})
