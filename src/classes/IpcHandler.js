const { ipcMain, shell, app } = require('electron');
const { request } = require('https');
const { join } = require('path');

module.exports = class IpcHandler {
  #store;
  #settings;
  #updater;
  #tray;

  constructor(getWindow, handler, sendUpdate, store, sendNotification, settings, updater, tray) {
    this.getWindow        = getWindow;
    this.handler          = handler;
    this.sendUpdate       = sendUpdate;
    this.sendNotification = sendNotification;

    this.#store    = store;
    this.#settings = settings;
    this.#updater  = updater;
    this.#tray     = tray;

    this.#register();

    if (!app.isPackaged) this.#registerDev();
  }

  #fetchPlayer(username) {
    return new Promise((resolve, reject) => {
      const req = request({
        hostname: process.env.SERVER_API_HOSTNAME,
        path:     `/api/player/${encodeURIComponent(username)}`,
        method:   'GET',
        headers:  {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':     '*/*'
        },
      }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        let raw = '';
        res.on('data', (chunk) => raw += chunk);
        res.on('end',  () => {
          try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
      });

      req.setTimeout(10000, () => req.destroy());
      req.on('error', reject);
      req.end();
    });
  }

  #searchPlayers(query) {
    return new Promise((resolve, reject) => {
      const req = request({
        hostname: process.env.SERVER_API_HOSTNAME,
        path:     `/api/players?search=${encodeURIComponent(query)}`,
        method:   'GET',
        headers:  {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':     '*/*'
        },
      }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        let raw = '';

        res.on('data', (chunk) => raw += chunk);
        res.on('end',  () => {
          try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
        });
      });

      req.setTimeout(10000, () => req.destroy());
      req.on('error', reject);
      req.end();
    });
  }

  #register() {
    ipcMain.on('window:minimize', () => this.getWindow()?.minimize());
    ipcMain.on('window:close',    () => this.getWindow()?.close());

    ipcMain.handle('app:version', () => app.getVersion());

    ipcMain.on('shell:openExternal',  (_e, url) => shell.openExternal(url));
    ipcMain.on('shell:openDataFolder', () => shell.openPath(join(process.env.APPDATA, process.env.STORE_DIR)));

    ipcMain.on('game:stop', async () => {
      if (this.handler.game.started) await this.handler.save();
      await this.handler.reset();
      this.sendUpdate();
    });

    ipcMain.on('game:delete', (_e, id) => {
      this.#store.remove(id);
      this.sendUpdate();
      this.sendNotification('partie supprimée', `identifiant: ${id}`);
    });

    ipcMain.handle('player:fetch',   (_e, username) => this.#fetchPlayer(username).catch(() => null));
    ipcMain.handle('players:search', (_e, query)    => this.#searchPlayers(query).catch(() => null));

    ipcMain.handle('settings:get', () => this.#settings.get());

    ipcMain.handle('settings:set', (_e, key, value) => {
      const updated = this.#settings.set(key, value);

      if (key === 'tray') value ? this.#tray.createTray() : this.#tray.destroyTray();

      this.getWindow()?.webContents.send('settings:update', updated);

      return updated;
    });

    ipcMain.on('update:install', (_e, downloadUrl) => {
      const win        = this.getWindow();
      const onProgress = (data) => win?.webContents.send('download:progress', data);
      const onError    = ()     => win?.webContents.send('update:error');

      this.#updater.on('download:progress', onProgress);
      this.#updater.once('update:error', onError);

      this.#updater.install(downloadUrl).finally(() => {
        this.#updater.off('download:progress', onProgress);
        this.#updater.off('update:error', onError);
      });
    });
  }

  #registerDev() {
    const Simulator = require('../../tests/Simulator');
    const sim       = new Simulator(this.handler, this.sendUpdate);

    ipcMain.on('sim:start', () => sim.start());
    ipcMain.on('sim:stop',  () => sim.stop());
  }
}