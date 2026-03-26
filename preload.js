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

  getVersion:     () => ipcRenderer.invoke('app:version'),
  openExternal:   (url) => ipcRenderer.send('shell:openExternal', url),
  openDataFolder: () => ipcRenderer.send('shell:openDataFolder'),
  stopGame:       () => ipcRenderer.send('game:stop'),
  deleteGame:     (id) => ipcRenderer.send('game:delete', id),
  minimize:       () => ipcRenderer.send('window:minimize'),
  close:          () => ipcRenderer.send('window:close'),
  fetchPlayer:    (username) => ipcRenderer.invoke('player:fetch', username),
  searchPlayers:  (username) => ipcRenderer.invoke('players:search', username),
  getSettings:    () => ipcRenderer.invoke('settings:get'),
  setSetting:     (key, value) => ipcRenderer.invoke('settings:set', key, value),
  simStart:       () => ipcRenderer.send('sim:start'),
  simStop:        () => ipcRenderer.send('sim:stop')
});