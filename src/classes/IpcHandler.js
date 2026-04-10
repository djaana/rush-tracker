const { ipcMain, shell, app } = require('electron');
const { join } = require('path');

const Logger = require('./Logger');

module.exports = class IpcHandler {
  #logger;
  #getWindow;
  #handler;
  #sendUpdate;
  #sendNotification;
  #history;
  #settings;
  #updater;
  #debugLogger;
  #tray;
  #apiClient;

  constructor(getWindow, handler, sendUpdate, history, sendNotification, settings, updater, debugLogger, tray, apiClient) {
    this.#logger = new Logger();
    this.#getWindow = getWindow;
    this.#handler = handler;
    this.#sendUpdate = sendUpdate;
    this.#sendNotification = sendNotification;
    this.#history = history;
    this.#settings = settings;
    this.#updater = updater;
    this.#debugLogger = debugLogger;
    this.#tray = tray;
    this.#apiClient = apiClient;

    this.#register();

    if (!app.isPackaged) this.#registerDev();
  }

  async #apiFetch(params) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://${process.env.SERVER_HOSTNAME}${process.env.SERVER_API_PATH}?${qs}`, {
      signal: AbortSignal.timeout(10000)
    });

    return { code: res.status, data: await res.json() };
  }

  #fetchPlayer(username) {
    return this.#apiFetch({ action: 'player', name: username });
  }

  #fetchPlayers() {
    return this.#apiFetch({ action: 'server-status' });
  }

  #searchPlayers(query) {
    return this.#apiFetch({ action: 'players', search: query });
  }

  #getPlayerPage(username) {
    return `https://${process.env.SERVER_HOSTNAME}${process.env.SERVER_PLAYER_PATH}${username}`;
  }

  #register() {
    ipcMain.on('window:minimize', () => this.#getWindow()?.minimize());
    ipcMain.on('window:close', () => this.#getWindow()?.close());

    ipcMain.handle('app:version', () => app.getVersion());

    ipcMain.on('shell:openExternal', (_e, url) => shell.openExternal(url));
    ipcMain.on('shell:openDataFolder', () => shell.openPath(join(process.env.APPDATA, process.env.STORE_DIR)));

    ipcMain.on('game:stop', async () => {
      if (this.#handler.game.started) await this.#handler.save();
      await this.#handler.reset();
      this.#sendUpdate();
    });

    ipcMain.on('game:delete', (_e, id) => {
      this.#history.remove(id);
      this.#sendUpdate();
      this.#sendNotification('partie supprimée', `identifiant: ${id}`);
    });

    ipcMain.handle('player:fetch', async (_e, username) => {
      try {
        return await this.#fetchPlayer(username);
      } catch (err) {
        this.#logger.error(err);
        return null;
      }
    });

    ipcMain.handle('player:get', (_e, username) => this.#getPlayerPage(username));
    ipcMain.handle('player:check', (_e, username) => this.#apiClient.checkUser(username));

    ipcMain.handle('players:fetch', async () => {
      try {
        return await this.#fetchPlayers();
      } catch (err) {
        this.#logger.error(err);
        return null;
      }
    });

    ipcMain.handle('players:search', async (_e, query) => {
      try {
        return await this.#searchPlayers(query);
      } catch (err) {
        this.#logger.error(err);
        return null;
      }
    });

    ipcMain.handle('settings:get', () => this.#settings.get());

    ipcMain.handle('settings:set', (_e, key, value) => {
      const updated = this.#settings.set(key, value);

      if (key === 'tray') value ? this.#tray.createTray() : this.#tray.destroyTray();
      if (key === 'startup') app.setLoginItemSettings({
        openAtLogin: value,
        path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
      });
      if (key === 'aot') this.#getWindow()?.setAlwaysOnTop(value);

      this.#getWindow()?.webContents.send('settings:update', updated);

      return updated;
    });

    ipcMain.on('update:install', (_e, downloadUrl) => {
      const win = this.#getWindow();
      const onProgress = (data) => win?.webContents.send('download:progress', data);
      const onError = () => win?.webContents.send('update:error');

      this.#updater.on('download:progress', onProgress);
      this.#updater.once('update:error', onError);

      this.#updater.install(downloadUrl).finally(() => {
        this.#updater.off('download:progress', onProgress);
        this.#updater.off('update:error', onError);
      });
    });

    ipcMain.on('debug:open', () => this.#debugLogger.open());
    ipcMain.on('debug:close', () => this.#debugLogger.close());
  }

  #registerDev() {
    const Simulator = require('../../tests/Simulator');
    const sim = new Simulator(this.#handler, this.#sendUpdate);

    ipcMain.on('sim:start', () => sim.start());
    ipcMain.on('sim:stop', () => sim.stop());
  }
};
