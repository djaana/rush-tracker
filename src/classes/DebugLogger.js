const { BrowserWindow } = require('electron');
const { join } = require('path');

const MAX_LOGS = 500;

module.exports = class DebugLogger {
  #buffer = [];
  #logWindow = null;
  #appDir;
  #iconPath;

  constructor(appDir, iconPath) {
    this.#appDir = appDir;
    this.#iconPath = iconPath;
  }

  attach() {
    const _log = console.log.bind(console);
    const _err = console.error.bind(console);

    const patch = (fn, level) => (...args) => {
      fn(...args);
      this.#push({
        source: 'main',
        level,
        text: args.join(' '),
        ts: Date.now()
      });
    };

    console.log = patch(_log, 'log');
    console.error = patch(_err, 'error');
  }

  attachRenderer(webContents) {
    webContents.on('console-message', (_e, level, message) => {
      this.#push({
        source: 'renderer',
        level: level >= 3 ? 'error' : 'log',
        text: message,
        ts: Date.now()
      });
    });
  }

  #push(line) {
    if (this.#buffer.length >= MAX_LOGS) this.#buffer.shift();

    this.#buffer.push(line);

    if (this.#logWindow && !this.#logWindow.isDestroyed()) {
      this.#logWindow.webContents.send('log:line', line);
    }
  }

  open() {
    if (this.#logWindow && !this.#logWindow.isDestroyed()) return this.#logWindow.focus();

    this.#logWindow = new BrowserWindow({
      width: 620, height: 420,
      minWidth: 620, minHeight: 420,
      frame: false,
      backgroundColor: '#1a1a1a',
      icon: this.#iconPath,
      webPreferences: {
        preload: join(this.#appDir, 'src', 'debug', 'preload.js'),
        backgroundThrottling: false
      }
    });

    this.#logWindow.setMenu(null);
    this.#logWindow.loadFile(join(this.#appDir, 'src', 'debug', 'index.html'));
    this.#logWindow.webContents.once('did-finish-load', () => {
      this.#logWindow.webContents.send('log:init', this.#buffer);
    });

    this.#logWindow.on('closed', () => {
      this.#logWindow = null;
    });
  }

  close() {
    this.#logWindow?.close();
  }
};
