const { ipcMain, shell, app } = require('electron');
const { request } = require('https');
const { join } = require('path');

module.exports = class IpcHandler {
  #store;
  #settings;
  #trayCtrl;

  constructor(getWindow, handler, sendUpdate, store, sendNotification, settings, trayCtrl) {
    this.#store      = store;
    this.#settings   = settings;
    this.#trayCtrl   = trayCtrl;

    this.getWindow        = getWindow;
    this.handler          = handler;
    this.sendUpdate       = sendUpdate;
    this.sendNotification = sendNotification;

    this.#register();

    if (!app.isPackaged) this.#registerDev();
  }

  #fetchPlayer(username) {
    return new Promise((resolve, reject) => {
      const req = request({
        hostname: process.env.API_HOSTNAME,
        path:     `/api/player/${encodeURIComponent(username)}`,
        method:   'GET',
        headers:  {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':     '*/*',
          'Referer':    `https://${process.env.API_HOSTNAME}/joueur?name=${username}`,
        },
      }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        let raw = '';
        res.on('data', (chunk) => raw += chunk);
        res.on('end',  () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(e); }
        });
      });

      req.setTimeout(10000, () => req.destroy());
      req.on('error', reject);
      req.end();
    });
  }

  #searchPlayers(username) {
    return new Promise((resolve) => {
      const req = request({
        hostname: 'www.fancraft.eu',
        path:     `/api/players?search=${encodeURIComponent(username)}`,
        method:   'GET',
        headers:  {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':     'application/json',
        },
      }, (res) => {
        if (res.statusCode !== 200) return resolve([]);

        let raw = '';
        res.on('data', (chunk) => raw += chunk);
        res.on('end',  () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch {
            resolve([]);
          }
        });
      });

      req.setTimeout(10000, () => req.destroy());
      req.on('error', () => resolve([]));
      req.end();
    });
  }

  #register() {
    ipcMain.on('window:minimize',    () => this.getWindow()?.minimize());
    ipcMain.on('window:close',       () => this.getWindow()?.close());
    ipcMain.handle('app:version',    () => app.getVersion());
    ipcMain.on('shell:openExternal', (_e, url) => shell.openExternal(url));
    ipcMain.on('shell:openDataFolder', () => {
      shell.openPath(join(process.env.APPDATA, process.env.STORE_DIR));
    });

    ipcMain.on('game:delete', (_e, id) => {
      this.#store.remove(id);
      this.sendUpdate();
      this.sendNotification('partie supprimée', `identifiant: ${id}`);
    });

    ipcMain.on('game:stop', async () => {
      if (this.handler.game.started) await this.handler.save();
      await this.handler.reset();
      this.sendUpdate();
    });

    ipcMain.handle('player:fetch',   (_e, username) => this.#fetchPlayer(username).catch(() => null));
    ipcMain.handle('players:search', (_e, username) => this.#searchPlayers(username));

    ipcMain.handle('settings:get', () => this.#settings.get());
    ipcMain.handle('settings:set', (_e, key, value) => {
      const updated = this.#settings.set(key, value);

      if (key === 'tray') {
        value ? this.#trayCtrl.createTray() : this.#trayCtrl.destroyTray();
      }

      this.getWindow()?.webContents.send('settings:update', updated);

      return updated;
    });
  }

  #registerDev() {
    const Simulator = require('../../tests/Simulator');
    const sim       = new Simulator(this.handler, this.sendUpdate);

    ipcMain.on('sim:start', () => sim.start());
    ipcMain.on('sim:stop',  () => sim.stop());
  }
}