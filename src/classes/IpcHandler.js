const { ipcMain, shell, app } = require('electron');
const { request } = require('https');
const { join } = require('path');

module.exports = class IpcHandler {
  #store;
  #settings;
  #updater;
  #tray;

  constructor(getWindow, handler, sendUpdate, store, sendNotification, settings, updater, tray) {
    this.getWindow = getWindow;
    this.handler = handler;
    this.sendUpdate = sendUpdate;
    this.sendNotification = sendNotification;

    this.#store = store;
    this.#settings = settings;
    this.#updater = updater;
    this.#tray = tray;

    this.#register();

    if (!app.isPackaged) this.#registerDev();
  }

  async #fetchPlayer(username) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`https://${process.env.SERVER_HOSTNAME}${process.env.SERVER_API_PATH}?action=player&name=${username}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    return {
      code: res.status,
      data: await res.json()
    };
  }

  async #searchPlayers(query) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`https://${process.env.SERVER_HOSTNAME}${process.env.SERVER_API_PATH}?action=players&search=${query}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    return {
      code: res.status,
      data: await res.json()
    };
  }

  #getPlayerPage(username) {
    return `https://${process.env.SERVER_HOSTNAME}${process.env.SERVER_PLAYER_PATH}${username}`;
  }

  #register() {
    ipcMain.on('window:minimize', () => this.getWindow()?.minimize());
    ipcMain.on('window:close', () => this.getWindow()?.close());

    ipcMain.handle('app:version', () => app.getVersion());

    ipcMain.on('shell:openExternal', (_e, url) => shell.openExternal(url));
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

    ipcMain.handle('player:fetch', (_e, username) => this.#fetchPlayer(username).catch(() => null));
    ipcMain.handle('players:search', (_e, query) => this.#searchPlayers(query).catch(() => null));
    ipcMain.handle('player:get', (_e, username) => this.#getPlayerPage(username));

    ipcMain.handle('settings:get', () => this.#settings.get());

    ipcMain.handle('settings:set', (_e, key, value) => {
      const updated = this.#settings.set(key, value);

      if (key === 'tray') value ? this.#tray.createTray() : this.#tray.destroyTray();

      this.getWindow()?.webContents.send('settings:update', updated);

      return updated;
    });

    ipcMain.on('update:install', (_e, downloadUrl) => {
      const win = this.getWindow();
      const onProgress = (data) => win?.webContents.send('download:progress', data);
      const onError = () => win?.webContents.send('update:error');

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
    const sim = new Simulator(this.handler, this.sendUpdate);

    ipcMain.on('sim:start', () => sim.start());
    ipcMain.on('sim:stop', () => sim.stop());
  }
}