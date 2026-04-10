const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onGameUpdate: (callback) => {
    ipcRenderer.removeAllListeners('game:update');
    ipcRenderer.on('game:update', (_e, data) => callback(data));
  },
  onNotification: (callback) => {
    ipcRenderer.removeAllListeners('notification:push');
    ipcRenderer.on('notification:push', (_e, data) => callback(data));
  },
  onSettingsUpdate: (callback) => {
    ipcRenderer.removeAllListeners('settings:update');
    ipcRenderer.on('settings:update', (_e, data) => callback(data));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.removeAllListeners('update:available');
    ipcRenderer.on('update:available', (_e, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.removeAllListeners('download:progress');
    ipcRenderer.on('download:progress', (_e, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.removeAllListeners('update:error');
    ipcRenderer.on('update:error', () => callback());
  },

  getVersion: () => ipcRenderer.invoke('app:version'),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
  openDataFolder: () => ipcRenderer.send('shell:openDataFolder'),
  stopGame: () => ipcRenderer.send('game:stop'),
  deleteGame: (id) => ipcRenderer.send('game:delete', id),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  fetchPlayer: (username) => ipcRenderer.invoke('player:fetch', username),
  getPlayerPage: (username) => ipcRenderer.invoke('player:get', username),
  checkUser: (username) => ipcRenderer.invoke('player:check', username),
  fetchPlayers: () => ipcRenderer.invoke('players:fetch'),
  searchPlayers: (query) => ipcRenderer.invoke('players:search', query),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  installUpdate: (downloadUrl) => ipcRenderer.send('update:install', downloadUrl),
  openDebug: () => ipcRenderer.send('debug:open'),
  simStart: () => ipcRenderer.send('sim:start'),
  simStop: () => ipcRenderer.send('sim:stop')
});
