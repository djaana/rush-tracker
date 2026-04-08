const { createHash, createHmac } = require('node:crypto');
const { networkInterfaces } = require('node:os');
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join, dirname } = require('path');

const Logger = require('./Logger');

const MAX_REGISTER_RETRIES = 5;

module.exports = class ApiClient {
  #logger;
  
  #path;
  #token = null;
  #self = null;
  #heartbeatInterval = null;
  #retryTimeout = null;
  #retryResolve = null;
  #destroyed = false;

  constructor(dir) {
    this.#logger = new Logger();
    this.#path = join(dir, 'data.bin');
  }

  #magic() {
    return Buffer.from(process.env.STORE_MAGIC, 'hex');
  }

  #getHwid() {
    const macs = [];

    for (const iface of Object.values(networkInterfaces())) {
      for (const addr of iface) {
        if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
          macs.push(addr.mac);
        }
      }
    }

    if (!macs.length) throw new Error('aucune interface réseau trouvée');

    return createHash('sha256').update(macs.sort()[0]).digest('hex');
  }

  #createClientToken() {
    const hwid = this.#getHwid();
    const hwidB64 = Buffer.from(hwid).toString('base64url');
    const sig = createHmac('sha256', process.env.KEY_B).update(hwid).digest('base64url');

    return `${hwidB64}.${sig}`;
  }

  #read() {
    if (!existsSync(this.#path)) return null;

    const buf = readFileSync(this.#path);
    const magic = this.#magic();

    if (buf.length < magic.length || !buf.subarray(0, magic.length).equals(magic)) return null;

    return buf.subarray(magic.length).toString('utf8').trim();
  }

  #write(token) {
    const magic = this.#magic();

    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, Buffer.concat([magic, Buffer.from(token, 'utf8')]));

    this.#logger.log('token enregistré');
  }

  async #register() {
    const res = await fetch(`http://${process.env.API}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.#createClientToken()}` },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) throw new Error(`register: HTTP ${res.status}`);

    const { token } = await res.json();

    return token;
  }

  async #reauth() {
    this.#token = await this.#register();
    this.#write(this.#token);
  }

  async #authedFetch(url, options = {}) {
    const build = (token) => ({
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` }
    });

    const res = await fetch(url, build(this.#token));

    if (res.status !== 401) return res;

    await this.#reauth();

    return fetch(url, build(this.#token));
  }

  #sleep(ms) {
    return new Promise((resolve) => {
      this.#retryResolve = resolve;
      this.#retryTimeout = setTimeout(() => {
        this.#retryTimeout = null;
        this.#retryResolve = null;
        resolve();
      }, ms);
    });
  }

  async #retryRegister(attempt = 0) {
    try {
      this.#token = await this.#register();
      this.#write(this.#token);

      this.#logger.log(`enregistrement réussi (tentative ${attempt + 1})`);
    } catch (err) {
      this.#logger.error(err);

      if (this.#destroyed || attempt >= MAX_REGISTER_RETRIES) return;

      const delay = Math.min(1000 * 2 ** attempt, 30_000);

      this.#logger.log(`nouvel essai dans ${delay / 1000}s (${attempt + 1}/${MAX_REGISTER_RETRIES})`);

      await this.#sleep(delay);

      if (this.#destroyed) return;

      await this.#retryRegister(attempt + 1);
    }
  }

  async init() {
    const stored = this.#read();

    if (stored) {
      this.#token = stored;
      return;
    }

    await this.#retryRegister();
  }

  setSelf(username) {
    this.#self = username ?? null;
    this.#syncHeartbeat();
  }

  #syncHeartbeat() {
    if (this.#self) {
      if (this.#heartbeatInterval) return;
      this.#beat();
      this.#heartbeatInterval = setInterval(() => this.#beat(), 10_000);
    } else {
      if (!this.#heartbeatInterval) return;
      clearInterval(this.#heartbeatInterval);
      this.#heartbeatInterval = null;
    }
  }

  async #beat() {
    if (!this.#self || !this.#token) return;

    try {
      await this.#authedFetch(`http://${process.env.API}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.#self }),
        signal: AbortSignal.timeout(5000)
      });
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') return;
      this.#logger.error(err);
    }
  }

  async checkUser(username) {
    if (!this.#token) return false;

    try {
      const res = await this.#authedFetch(
        `http://${process.env.API}/users?username=${encodeURIComponent(username)}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!res.ok) return false;

      const data = await res.json();

      return Array.isArray(data) && data.some((u) => u.username?.toLowerCase() === username.toLowerCase());
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') return false;
      this.#logger.error(err);
      return false;
    }
  }

  destroy() {
    this.#destroyed = true;

    if (this.#retryTimeout) {
      clearTimeout(this.#retryTimeout);
      this.#retryTimeout = null;
    }

    this.#retryResolve?.();
    this.#retryResolve = null;

    if (this.#heartbeatInterval) {
      clearInterval(this.#heartbeatInterval);
      this.#heartbeatInterval = null;
    }
  }

  get token() {
    return this.#token;
  }
};
