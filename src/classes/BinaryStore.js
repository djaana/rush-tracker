const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs');
const { inflateSync, deflateSync } = require('zlib');
const { dirname } = require('path');

module.exports = class BinaryStore {
  #path;
  #compress;

  constructor(path, { compress = false } = {}) {
    this.#path = path;
    this.#compress = compress;
  }

  #magic() {
    return Buffer.from(process.env.STORE_MAGIC, 'hex');
  }

  read() {
    if (!existsSync(this.#path)) return null;

    const buf = readFileSync(this.#path);
    const magic = this.#magic();

    if (buf.length < magic.length || !buf.subarray(0, magic.length).equals(magic)) return null;

    const payload = buf.subarray(magic.length);

    return this.#compress ? inflateSync(payload) : payload;
  }

  write(data) {
    const magic = this.#magic();
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const payload = this.#compress ? deflateSync(buf) : buf;

    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, Buffer.concat([magic, payload]));
  }
};
