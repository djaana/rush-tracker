const { ipcMain, shell, app } = require('electron');

const https = require('https');

module.exports = class IpcHandler {
    constructor(getWindow, handler, sendUpdate, store) {
        this.getWindow  = getWindow;
        this.handler    = handler;
        this.sendUpdate = sendUpdate;
        this.store      = store;

        this.#register();

        if (!app.isPackaged) this.#registerDev();
    };

    #fetchPlayer(username) {
        return new Promise((resolve, reject) => {
            const req = https.request({
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
                    try {
                        resolve(JSON.parse(raw));
                    } catch (e) {
                        reject(e);
                    };
                });
            });

            req.on('error', reject);
            req.end();
        });
    };

    #register() {
        ipcMain.on('window:minimize',    () => this.getWindow()?.minimize());
        ipcMain.on('window:close',       () => this.getWindow()?.close());
        ipcMain.handle('app:version',    () => app.getVersion());
        ipcMain.on('shell:openExternal', (_e, url) => shell.openExternal(url));

        ipcMain.on('game:delete', (_e, id) => {
            this.store.remove(id);
            this.sendUpdate();
        });

        ipcMain.on('game:stop', async () => {
            if (this.handler.game.started) await this.handler.save();

            await this.handler.reset();

            this.sendUpdate();
        });

        ipcMain.handle('player:fetch', (_e, username) => this.#fetchPlayer(username).catch(() => null));
    };
 
    #registerDev() {
        const Simulator = require('../../tests/Simulator');
        const sim       = new Simulator(this.handler, this.sendUpdate);
 
        ipcMain.on('sim:start', () => sim.start());
        ipcMain.on('sim:stop',  () => sim.stop());
    };
};