const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getDefaultDataPath: () => ipcRenderer.invoke('get-default-data-path'),
  getCustomDataPath: () => ipcRenderer.invoke('get-custom-data-path'),
  setCustomDataPath: (path) => ipcRenderer.invoke('set-custom-data-path', path),
  getDataDirectories: () => ipcRenderer.invoke('get-data-directories'),
  openFolder: (folderType) => ipcRenderer.invoke('open-folder', folderType),
  saveExportFile: (data) => ipcRenderer.invoke('save-export-file', data),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),
  setLoginItem: (openAtLogin) => ipcRenderer.invoke('set-login-item', openAtLogin),
  getLoginItemSettings: () => ipcRenderer.invoke('get-login-item-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateTrayVisibility: () => ipcRenderer.invoke('update-tray-visibility'),
  saveMiniplayerState: (state) => ipcRenderer.invoke('save-miniplayer-state', state),
  getMiniplayerState: () => ipcRenderer.invoke('get-miniplayer-state'),
  onNewSession: (callback) => ipcRenderer.on('new-session', callback),
  onMaximized: (callback) => ipcRenderer.on('window-maximized', callback),
  initDiscordRPC: (clientId) => ipcRenderer.invoke('init-discord-rpc', clientId),
  setDiscordActivity: (activity) => ipcRenderer.invoke('set-discord-activity', activity),
  clearDiscordActivity: () => ipcRenderer.invoke('clear-discord-activity'),
  destroyDiscordRPC: () => ipcRenderer.invoke('destroy-discord-rpc'),
  onUnmaximized: (callback) => ipcRenderer.on('window-unmaximized', callback),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    const subscription = (event, data) => callback(data)
    ipcRenderer.on('update-status', subscription)
    return () => ipcRenderer.removeListener('update-status', subscription)
  },
  send: (channel, data) => {
    const validChannels = ['window-minimize', 'window-maximize', 'window-close', 'start-scraper', 'pause-scraper', 'resume-scraper', 'stop-scraper']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  onScraperUpdate: (callback) => {
    const subscription = (event, data) => callback(data)
    ipcRenderer.on('scraper-update', subscription)
    return () => ipcRenderer.removeListener('scraper-update', subscription)
  }
})
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await ipcRenderer.invoke('get-settings')
    if (settings?.interface?.fontSize) {
      document.documentElement.style.fontSize = `${settings.interface.fontSize}px`
      document.documentElement.style.setProperty('--toast-scale', (settings.interface.fontSize / 16).toString())
    }
  } catch (error) {
    console.error('Preload font size error:', error)
  }
})