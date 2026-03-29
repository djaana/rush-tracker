const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join, dirname } = require('path');

const Logger = require('./Logger');

const DEFAULTS = {
  notifications: true,
  tray: false,
  animations: true,
};

module.exports = class Settings {
  #logger;
  #path;
  #data;

  constructor(dir) {
    this.#logger = new Logger();

    this.#path = join(dir, 'settings.json');
    this.#data = this.#load();
  }

  #load() {
    try {
      if (!existsSync(this.#path)) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(readFileSync(this.#path, 'utf8')) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  get(key) {
    return key !== undefined ? this.#data[key] : { ...this.#data };
  }

  set(key, value) {
    this.#data[key] = value;
    this.#save();

    this.#logger.log(`paramètre modifié: ${key}: ${value}`);

    return { ...this.#data };
  }

  #save() {
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, JSON.stringify(this.#data, null, 2), 'utf8');
  }
};