const { app, Notification } = require('electron');
const { request } = require('https');
const { createWriteStream, writeFileSync } = require('fs');
const { join, basename } = require('path');
const { tmpdir } = require('os');
const { spawn } = require('child_process');

const EventEmitter = require('events');

module.exports = class Updater extends EventEmitter {
  #interval = null;
  #current;
  #iconPath;

  constructor(iconPath) {
    super();

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

  #get(url) {
    return new Promise((resolve, reject) => {
      const req = request(url, {
        headers: {
          'User-Agent': 'rush-tracker-updater',
          'Accept':     'application/vnd.github+json'
        }
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) return resolve(this.#get(res.headers.location));
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        let raw = '';

        res.on('data', (c) => raw += c);
        res.on('end',  () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
      });

      req.setTimeout(10000, () => req.destroy());
      req.on('error', reject);
      req.end();
    });
  }

  #download(url, dest) {
    return new Promise((resolve, reject) => {
      const follow = (u) => {
        const req = request(u, { headers: { 'User-Agent': 'rush-tracker-updater' } }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) return follow(res.headers.location);
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

          const total   = parseInt(res.headers['content-length'] || '0', 10);
          let received  = 0;
          let startTime = Date.now();
          let lastEmit  = 0;

          const file = createWriteStream(dest);

          res.on('data', (chunk) => {
            received += chunk.length;

            if (total <= 0) return;

            const now = Date.now();
            if (now - lastEmit < 100) return;

            lastEmit = now;

            const elapsed = (now - startTime) / 1000;
            const rate    = elapsed > 0 ? received / elapsed : 0;
            const eta     = rate > 0 ? Math.ceil((total - received) / rate) : 0;

            this.emit('download:progress', { received, total, percent: received / total, eta });
          });

          res.pipe(file);

          file.on('finish', () => {
            if (total > 0) this.emit('download:progress', { received: total, total, percent: 1, eta: 0 });

            file.close(resolve);
          });

          file.on('error', reject);
        });

        req.setTimeout(120000, () => req.destroy());
        req.on('error', reject);
        req.end();
      };

      follow(url);
    });
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

      const child = spawn('cmd.exe', ['/c', 'start', '""', 'cmd.exe', '/c', batchPath], { detached: true, stdio: 'ignore', shell: true });
      child.unref();

      await new Promise((resolve) => setTimeout(resolve, 2000));

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