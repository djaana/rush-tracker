const { join } = require('path');

const Logger = require('./Logger');
const BinaryStore = require('./BinaryStore');

module.exports = class HistoryManager {
  #logger;
  #store;
  #cache = null;

  constructor() {
    this.#logger = new Logger();
    this.#store = new BinaryStore(
      join(process.env.APPDATA, process.env.STORE_DIR, 'cache'),
      { compress: true }
    );
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
      const buf = this.#store.read();
      if (!buf) return [];

      const games = JSON.parse(buf.toString('utf8'));
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
    this.#store.write(Buffer.from(JSON.stringify(games), 'utf8'));

    this.#logger.log(`cache écrit (${games.length} partie(s))`);
  }

  remove(id) {
    this.#cache = null;
    this.write(this.read().filter((g) => g.id !== id));

    this.#logger.log(`partie supprimée: ${id}`);
  }
};
