const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('log', {
  onInit: (cb) => ipcRenderer.on('log:init', (_e, data) => cb(data)),
  onLine: (cb) => ipcRenderer.on('log:line', (_e, data) => cb(data)),
  close: () => ipcRenderer.send('debug:close')
});
