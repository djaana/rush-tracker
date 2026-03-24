const fs           = require('fs');
const path         = require('path');
const zlib         = require('zlib');
const Logger       = require('./Logger');

const MAGIC = Buffer.from(process.env.STORE_MAGIC, 'hex');

module.exports = class Store {
    #cache;

    constructor() {
        this.logger = new Logger();
        this.dir    = path.join(process.env.APPDATA, process.env.STORE_DIR);
        this.file   = path.join(this.dir, 'cache');
    };

    read() {
        if (this.#cache) return this.#cache;
        try {
            if (!fs.existsSync(this.file)) return [];

            const buf = fs.readFileSync(this.file);
            if (buf.length < MAGIC.length || !buf.subarray(0, MAGIC.length).equals(MAGIC)) return [];

            const json = zlib.inflateSync(buf.subarray(MAGIC.length)).toString('utf8');

            return JSON.parse(json);
        } catch {
            return [];
        };
    };

    write(games) {
        this.#cache = games;

        fs.mkdirSync(this.dir, { recursive: true });

        const compressed = zlib.deflateSync(Buffer.from(JSON.stringify(games), 'utf8'));
        fs.writeFileSync(this.file, Buffer.concat([MAGIC, compressed]));

        this.logger.log(`cache écrit (${games.length} partie(s))`)
    };

    remove(id) {
        this.#cache = null;
        
        this.write(this.read().filter((g) => g.id !== id));

        this.logger.log(`partie supprimée: ${id}`);
    };
};