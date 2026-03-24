const fs           = require('fs');
const schedule     = require('node-schedule');
const EventEmitter = require('events');
const Logger       = require('./Logger');

module.exports = class LogWatcher extends EventEmitter {
    #logger;
    #waitInterval;
    #midnightJob;

    constructor(filePath) {
        super();

        this.#logger = new Logger();

        this.filePath       = filePath;
        this.lastSize       = 0;
    };

    #scheduleMidnight() {
        this.#midnightJob = schedule.scheduleJob('5 0 0 * * *', () => {
            this.#logger.log('minuit détecté, reprise');

            fs.unwatchFile(this.filePath);

            this.lastSize     = 0;
            this.#midnightJob = null;

            this.start();
        });
    };

    startWatching() {
        this.lastSize = fs.statSync(this.filePath).size;

        this.#logger.log('surveillance active');

        this.#scheduleMidnight();

        fs.watchFile(this.filePath, { interval: 1000 }, (current, previous) => {
            if (current.ino !== previous.ino || current.size < previous.size) {
                fs.unwatchFile(this.filePath);

                this.#logger.log('fichier réinitialisé, reprise...');

                this.lastSize = 0;
                this.startWatching();

                return;
            };

            if (current.size > previous.size) this.handleChange();
        });
    };

    handleChange() {
        const { size } = fs.statSync(this.filePath);
        const bufferSize = size - this.lastSize;
        const buffer     = Buffer.alloc(bufferSize);
        const fd         = fs.openSync(this.filePath, 'r');

        fs.readSync(fd, buffer, 0, bufferSize, this.lastSize);
        fs.closeSync(fd);

        this.lastSize = size;

        const logs = buffer.toString('utf8')
            .split(/\r?\n/)
            .map((log) => log.trim())
            .filter((log) => log.length > 0);

        if (logs.length > 0) {
            this.emit('log:update', logs);
        };
    };

    start() {
        if (!fs.existsSync(this.filePath)) {
            this.#logger.log('fichier introuvable, attente...');

            this.#waitInterval = setInterval(() => {
                if (fs.existsSync(this.filePath)) {
                    clearInterval(this.#waitInterval);
                    this.#waitInterval = null;
                    this.startWatching();
                };
            }, 1000);

            return;
        };

        this.startWatching();
    };

    stop() {
        if (this.#waitInterval) {
            clearInterval(this.#waitInterval);
            this.#waitInterval = null;
        };

        if (this.#midnightJob) {
            this.#midnightJob.cancel();
            this.#midnightJob = null;
        };

        fs.unwatchFile(this.filePath);

        this.#logger.log('surveillance arrêtée');
    };
};