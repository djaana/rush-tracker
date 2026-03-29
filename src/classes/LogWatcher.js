const { watchFile, unwatchFile, statSync, existsSync, openSync, readSync, closeSync } = require('fs');

const EventEmitter = require('events');
const Logger = require('./Logger');

module.exports = class LogWatcher extends EventEmitter {
  #logger;
  #waitInterval;
  #midnightJob;

  constructor(filePath) {
    super();

    this.#logger = new Logger();

    this.filePath = filePath;
    this.lastSize = 0;
  }

  startWatching() {
    this.lastSize = statSync(this.filePath).size;

    this.#logger.log('surveillance active');

    watchFile(this.filePath, { interval: 1000 }, (current, previous) => {
      if (current.ino !== previous.ino || current.size < previous.size) {
        unwatchFile(this.filePath);

        this.#logger.log('fichier réinitialisé, reprise...');

        this.lastSize = 0;
        this.start();

        return;
      }

      if (current.size > previous.size) this.handleChange();
    });
  }

  handleChange() {
    const { size } = statSync(this.filePath);
    const bufferSize = size - this.lastSize;
    const buffer = Buffer.alloc(bufferSize);
    const fd = openSync(this.filePath, 'r');

    readSync(fd, buffer, 0, bufferSize, this.lastSize);
    closeSync(fd);

    this.lastSize = size;

    const logs = buffer.toString('utf8')
      .split(/\r?\n/)
      .map((log) => log.trim())
      .filter((log) => log.length > 0);

    if (logs.length > 0) {
      this.emit('log:update', logs);
    }
  }

  start() {
    if (!existsSync(this.filePath)) {
      this.#logger.log('fichier introuvable, attente...');

      this.#waitInterval = setInterval(() => {
        if (existsSync(this.filePath)) {
          clearInterval(this.#waitInterval);
          this.#waitInterval = null;
          this.startWatching();
        }
      }, 1000);

      return;
    }

    this.startWatching();
  }

  stop() {
    if (this.#waitInterval) {
      clearInterval(this.#waitInterval);
      this.#waitInterval = null;
    }

    if (this.#midnightJob) {
      this.#midnightJob.cancel();
      this.#midnightJob = null;
    }

    unwatchFile(this.filePath);

    this.#logger.log('surveillance arrêtée');
  }
}