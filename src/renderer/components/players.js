import { kd, kdVal, bestPlayer } from './utils.js';

export default class Players {
  #el;
  #rows = new Map();
  #lastGameId = null;
  #isStaticRows = false;
  #currentPlayers = [];
  #onlineUsers = new Set();
  #pollIntervals = new Map();

  constructor(onPlayerClick, onPlayerContextMenu) {
    this.#el = document.getElementById('player-rows');

    this.#el.addEventListener('click', (e) => {
      const row = e.target.closest('.row');
      if (row) onPlayerClick(row.dataset.username);
    });

    this.#el.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.row');
      if (!row) return;

      const player = this.#currentPlayers.find((p) => p.username === row.dataset.username);
      if (player) onPlayerContextMenu(e, player, this.#currentPlayers);
    });
  }

  #sort(players, self) {
    const selfTeam = players.find((p) => p.self || p.username === self)?.team;
    const teams = ['blue', 'red'].sort((a) => (a === selfTeam ? -1 : 1));
    const order = Object.fromEntries(teams.map((t, i) => [t, i]));

    return [...players].sort((a, b) => {
      const td = (order[a.team] ?? 2) - (order[b.team] ?? 2);
      if (td !== 0) return td;

      const kdd = kdVal(b) - kdVal(a);
      if (kdd !== 0) return kdd;

      return a.username.localeCompare(b.username);
    });
  }

  #checkPresence(username) {
    if (this.#onlineUsers.has(username) || this.#pollIntervals.has(username)) return;

    const check = async () => {
      const online = await window.api.checkUser(username).catch(() => false);
      if (!online) return;

      this.#onlineUsers.add(username);
      clearInterval(this.#pollIntervals.get(username));
      this.#pollIntervals.delete(username);

      const entry = this.#rows.get(username);
      if (entry) entry.dot.classList.add('online');
    };

    check();
    this.#pollIntervals.set(username, setInterval(check, 10_000));
  }

  #makeRow(p, self, isBest, delay = 0, showDot = true) {
    const el = document.createElement('div');
    el.className = `row row-enter${p.connection === false ? ' disconnected' : ''}`;
    el.dataset.username = p.username;

    if (delay) el.style.animationDelay = `${delay}ms`;

    el.addEventListener('animationend', () => el.classList.remove('row-enter'), { once: true });

    const isSelf = p.self || p.username === self;
    const selfClass = isSelf ? ' self' : '';
    const crown = isBest && p.kills > 0 ? ' <span class="crown">👑</span>' : '';
    const breaker = p.breaker ? ' <span class="breaker">💥</span>' : '';

    const dotOnline = showDot && (isSelf || this.#onlineUsers.has(p.username));
    const dotClass = `presence-dot${!showDot ? ' hidden' : dotOnline ? ' online' : ''}`;

    el.innerHTML = `
      <span class="${dotClass}"></span>
      <img class="player-head${selfClass}" src="https://mc-heads.net/avatar/${p.username}" onerror="this.style.opacity='0'" />
      <span class="player-name ${p.team || 'none'}">${p.username}${crown}${breaker}</span>
      <div class="player-stats">
        <span class="stat-k">${p.kills}</span>
        <span class="stat-d">${p.deaths}</span>
        <span class="stat-kd">${kd(p.kills, p.deaths)}</span>
      </div>
    `;

    return {
      el,
      dot: el.querySelector('.presence-dot'),
      name: el.querySelector('.player-name'),
      k: el.querySelector('.stat-k'),
      d: el.querySelector('.stat-d'),
      kd: el.querySelector('.stat-kd')
    };
  }

  #updateRow(entry, p, isBest) {
    entry.el.className = `row${p.connection === false ? ' disconnected' : ''}`;

    const crown = isBest && p.kills > 0 ? ' <span class="crown">👑</span>' : '';
    const breaker = p.breaker ? ' <span class="breaker">💥</span>' : '';

    entry.name.className = `player-name ${p.team || 'none'}`;
    entry.name.innerHTML = `${p.username}${crown}${breaker}`;

    entry.k.textContent = p.kills;
    entry.d.textContent = p.deaths;
    entry.kd.textContent = kd(p.kills, p.deaths);
  }

  #showEmpty() {
    if (this.#el.querySelector('.empty-state')) return;
    const el = document.createElement('div');

    el.className = 'empty-state';
    el.textContent = 'en attente des joueurs...';

    this.#el.appendChild(el);
  }

  #clearRows() {
    this.#el.innerHTML = '';
    this.#rows.clear();
  }

  #clearPresence() {
    this.#onlineUsers.clear();
    for (const id of this.#pollIntervals.values()) clearInterval(id);
    this.#pollIntervals.clear();
  }

  #removePlayer(username, entry) {
    this.#rows.delete(username);
    entry.el.remove();

    clearInterval(this.#pollIntervals.get(username));
    this.#pollIntervals.delete(username);
    this.#onlineUsers.delete(username);
  }

  render(players, self, isStatic = false, gameId = null) {
    if (isStatic) {
      if (gameId === this.#lastGameId) return;
      this.#lastGameId = gameId;
    } else {
      this.#lastGameId = null;
    }

    if (!players?.length) {
      this.#currentPlayers = [];

      if (!this.#el.querySelector('.empty-state')) {
        this.#clearRows();
        this.#clearPresence();
        this.#showEmpty();
      }

      return;
    }

    const sorted = this.#sort(players, self);
    const bestP = bestPlayer(sorted);

    this.#currentPlayers = sorted;

    this.#el.querySelector('.empty-state')?.remove();

    if (isStatic) {
      this.#clearRows();
      this.#isStaticRows = true;

      sorted.forEach((p, i) => {
        const entry = this.#makeRow(p, self, p.username === bestP?.username, i * 25, false);
        this.#el.appendChild(entry.el);
        this.#rows.set(p.username, entry);
      });

      return;
    }

    if (this.#isStaticRows) {
      this.#clearRows();
      this.#isStaticRows = false;
    }

    const isInitial = this.#rows.size === 0;
    const incoming = new Set(sorted.map((p) => p.username));

    for (const [username, entry] of [...this.#rows]) {
      if (!incoming.has(username)) this.#removePlayer(username, entry);
    }

    sorted.forEach((p, i) => {
      const isBest = p.username === bestP?.username;

      if (this.#rows.has(p.username)) {
        this.#updateRow(this.#rows.get(p.username), p, isBest);
      } else {
        const delay = isInitial ? i * 25 : 0;
        const entry = this.#makeRow(p, self, isBest, delay, true);
        this.#el.appendChild(entry.el);
        this.#rows.set(p.username, entry);

        if (!(p.self || p.username === self)) this.#checkPresence(p.username);
      }
    });

    const currentOrder = [...this.#rows.keys()];
    const newOrder = sorted.map((p) => p.username);
    const sameOrder = currentOrder.length === newOrder.length &&
      currentOrder.every((u, i) => u === newOrder[i]);

    if (!sameOrder) {
      sorted.forEach((p) => this.#el.appendChild(this.#rows.get(p.username).el));
    }
  }
}
