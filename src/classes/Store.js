const { existsSync, readFileSync, mkdirSync, writeFileSync } = require('fs');
const { inflateSync, deflateSync } = require('zlib');
const { join } = require('path');

const Logger = require('./Logger');

const MAGIC = Buffer.from(process.env.STORE_MAGIC, 'hex');

module.exports = class Store {
  #logger;
  #cache;

  constructor() {
    this.#logger = new Logger();

    this.dir = join(process.env.APPDATA, process.env.STORE_DIR);
    this.file = join(this.dir, 'cache');
  }

  #migrate(games) {
    let changed = false;
    const result = games.map((g) => {
      if (g.state !== 'loose') return g;
      changed = true;
      return { ...g, state: 'loss' };
    });
    return { result, changed };
  }

  read() {
    if (this.#cache) return this.#cache;
    try {
      if (!existsSync(this.file)) return [];

      const buf = readFileSync(this.file);
      if (buf.length < MAGIC.length || !buf.subarray(0, MAGIC.length).equals(MAGIC)) return [];

      const json = inflateSync(buf.subarray(MAGIC.length)).toString('utf8');
      const games = JSON.parse(json);
      const { result, changed } = this.#migrate(games);

      if (changed) this.write(result);
      else this.#cache = result;

      return result;
    } catch {
      return [];
    }
  }

  write(games) {
    this.#cache = games;

    mkdirSync(this.dir, { recursive: true });

    const compressed = deflateSync(Buffer.from(JSON.stringify(games), 'utf8'));
    writeFileSync(this.file, Buffer.concat([MAGIC, compressed]));

    this.#logger.log(`cache écrit (${games.length} partie(s))`);
  }

  remove(id) {
    this.#cache = null;

    this.write(this.read().filter((g) => g.id !== id));

    this.#logger.log(`partie supprimée: ${id}`);
  }
};
