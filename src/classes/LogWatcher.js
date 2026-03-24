const fs           = require('fs');
const EventEmitter = require('events');
const Logger       = require('./Logger');

module.exports = class LogWatcher extends EventEmitter {
    constructor(filePath) {
        super();

        this.logger   = new Logger();
        this.filePath = filePath;
        this.lastSize = 0;
    };

    startWatching() {
        this.lastSize = fs.statSync(this.filePath).size;

        this.logger.log('surveillance active');

        fs.watchFile(this.filePath, { interval: 1000 }, (current, previous) => {
            if (current.ino !== previous.ino || current.size < previous.size) {
                fs.unwatchFile(this.filePath);

                this.logger.log('fichier réinitialisé, reprise...');

                this.lastSize = 0;
                this.startWatching();

                return;
            };

            if (current.size > previous.size) this.handleChange();
        });
    };

    handleChange() {
        const { size }   = fs.statSync(this.filePath);
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
            this.emit('logUpdate', logs);
        };
    };

    start() {
        if (!fs.existsSync(this.filePath)) {
            this.logger.log('fichier introuvable, attente...');

            const interval = setInterval(() => {
                if (fs.existsSync(this.filePath)) {
                    clearInterval(interval);
                    this.startWatching();
                };
            }, 1000);

            return;
        };

        this.startWatching();
    };

    stop() {
        fs.unwatchFile(this.filePath);

        this.logger.log('surveillance arrêtée');
    };
};
