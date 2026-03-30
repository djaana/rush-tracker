const { app, Notification } = require('electron');
const { createWriteStream, writeFileSync } = require('fs');
const { join, basename } = require('path');
const { tmpdir } = require('os');
const { spawn } = require('child_process');

const Logger = require('./Logger');

const EventEmitter = require('events');

module.exports = class Updater extends EventEmitter {
  #logger;
  #interval = null;
  #current;
  #iconPath;

  constructor(iconPath) {
    super();

    this.#logger = new Logger();

    this.#current  = app.getVersion();
    this.#iconPath = iconPath;

    this.quit = false;
  }

  #parse(v) {
    return v.replace(/^v/, '').split('.').map(Number);
  }

  #isNewer(tag) {
    const r = this.#parse(tag);
    const c = this.#parse(this.#current);

    for (let i = 0; i < 3; i++) {
      if ((r[i] || 0) > (c[i] || 0)) return true;
      if ((r[i] || 0) < (c[i] || 0)) return false;
    }

    return false;
  }

  async #get(url) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'rush-tracker-updater',
        'Accept':     'application/vnd.github+json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return res.json();
  }

  async #download(url, dest) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'rush-tracker-updater' }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const total     = parseInt(res.headers.get('content-length') || '0', 10);
    let received    = 0;
    let startTime   = Date.now();
    let lastEmit    = 0;

    const file   = createWriteStream(dest);
    const reader = res.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        file.write(value);
        received += value.length;

        if (total > 0) {
          const now = Date.now();

          if (now - lastEmit >= 100) {
            lastEmit = now;

            const elapsed = (now - startTime) / 1000;
            const rate    = elapsed > 0 ? received / elapsed : 0;
            const eta     = rate > 0 ? Math.ceil((total - received) / rate) : 0;

            this.emit('download:progress', { received, total, percent: received / total, eta });
          }
        }
      }

      await new Promise((resolve, reject) => {
        file.end(resolve);
        file.on('error', reject);
      });

      if (total > 0) this.emit('download:progress', { received: total, total, percent: 1, eta: 0 });

    } catch (e) {
      file.destroy();
      throw e;
    }
  }

  async #check() {
    try {
      const release = await this.#get(`https://${process.env.GITHUB_API_HOSTNAME}/repos/${process.env.GITHUB_REPO}/releases/latest`);
      if (!release?.tag_name || !this.#isNewer(release.tag_name)) return;

      const asset = release.assets?.find((a) => a.name.endsWith('.exe'));
      if (!asset) return;

      this.#stopInterval();
      this.emit('update:available', { version: release.tag_name, downloadUrl: asset.browser_download_url });

      new Notification({
        title: 'rush tracker',
        body:  `mise à jour ${release.tag_name} disponible`,
        icon:  this.#iconPath
      }).show();

      this.#logger.log(`mise à jour ${release.tag_name} disponible`);

    } catch {}
  }

  async install(downloadUrl) {
    try {
      const currentExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
      const newExe     = join(tmpdir(), basename(currentExe));
      const batchPath  = join(tmpdir(), 'update.bat');

      await this.#download(downloadUrl, newExe);

      const batch = [
        '@echo off',
        'chcp 65001 > nul',
        'title mise à jour en cours...',

        'echo \x1b[94m===============================\x1b[0m',
        'echo \x1b[93m   mise à jour de l\'application\x1b[0m',
        'echo \x1b[94m===============================\x1b[0m',
        'echo.',

        'echo \x1b[90m[*] attente du processus...\x1b[0m',
        'timeout /t 1 /nobreak > nul',

        ':retry',
        'echo \x1b[36m[*] tentative de remplacement...\x1b[0m',
        `copy /y "${newExe}" "${currentExe}" > nul`,

        'if errorlevel 1 (',
        '  echo \x1b[91m[!] fichier encore verrouillé, nouvel essai...\x1b[0m',
        '  timeout /t 1 /nobreak > nul',
        '  goto retry',
        ')',

        'echo.',
        'echo \x1b[92m[+] remplacement réussi !\x1b[0m',

        `del /f /q "${newExe}"`,
        'echo \x1b[90m[*] nettoyage terminé\x1b[0m',

        'echo.',
        'echo \x1b[93m[*] relancement de l\'application...\x1b[0m',
        `start "" "${currentExe}"`,

        'echo.',
        'echo \x1b[92m[+] terminé ! fermeture...\x1b[0m',
        'timeout /t 2 > nul',

        'del /f /q "%~f0"'
      ].join('\r\n');

      writeFileSync(batchPath, batch, 'utf8');

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const child = spawn('cmd.exe', ['/c', 'start', '""', 'cmd.exe', '/c', batchPath], { detached: true, stdio: 'ignore' });
      child.unref();

      app.exit(0);
    } catch (e) {
      this.emit('update:error', e);
    }
  }

  #stopInterval() {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }

  start() {
    this.#check();
    this.#interval = setInterval(() => this.#check(), 60000);
  }

  stop() {
    this.#stopInterval();
  }
}