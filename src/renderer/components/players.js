import { kd, kdVal, bestPlayer } from './utils.js';

export default class Players {
  #el;
  #rows           = new Map();
  #lastGameId     = null;
  #currentPlayers = [];

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
    const teams    = ['blue', 'red'].sort((a) => (a === selfTeam ? -1 : 1));
    const order    = Object.fromEntries(teams.map((t, i) => [t, i]));

    return [...players].sort((a, b) => {
      const td  = (order[a.team] ?? 2) - (order[b.team] ?? 2);
      if (td  !== 0) return td;

      const kdd = kdVal(b) - kdVal(a);
      if (kdd !== 0) return kdd;

      return a.username.localeCompare(b.username);
    });
  }

  #makeRow(p, self, isBest, delay = 0) {
    const el = document.createElement('div');
    el.className = `row row-enter${p.connection === false ? ' disconnected' : ''}`;
    el.dataset.username = p.username;

    if (delay) el.style.animationDelay = `${delay}ms`;

    el.addEventListener('animationend', () => el.classList.remove('row-enter'), { once: true });

    const selfClass = (p.self || p.username === self) ? ' self' : '';
    const crown     = isBest && p.kills > 0 ? ' <span class="crown">👑</span>' : '';
    const breaker   = p.breaker ? ' <span class="breaker">💥</span>' : '';

    el.innerHTML = `
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
      name: el.querySelector('.player-name'),
      k:    el.querySelector('.stat-k'),
      d:    el.querySelector('.stat-d'),
      kd:   el.querySelector('.stat-kd')
    };
  }

  #updateRow(entry, p, isBest) {
    entry.el.className = `row${p.connection === false ? ' disconnected' : ''}`;

    const crown   = isBest && p.kills > 0 ? ' <span class="crown">👑</span>' : '';
    const breaker = p.breaker ? ' <span class="breaker">💥</span>' : '';

    entry.name.className = `player-name ${p.team || 'none'}`;
    entry.name.innerHTML = `${p.username}${crown}${breaker}`;

    entry.k.textContent  = p.kills;
    entry.d.textContent  = p.deaths;
    entry.kd.textContent = kd(p.kills, p.deaths);
  }

  #showEmpty() {
    if (this.#el.querySelector('.empty-state')) return;
    const el = document.createElement('div');

    el.className   = 'empty-state';
    el.textContent = 'en attente des joueurs...';

    this.#el.appendChild(el);
  }

  #clear() {
    this.#el.innerHTML = '';
    this.#rows.clear();
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
        this.#clear();
        this.#showEmpty();
      }

      return;
    }

    const sorted = this.#sort(players, self);
    const bestP  = bestPlayer(sorted);

    this.#currentPlayers = sorted;

    this.#el.querySelector('.empty-state')?.remove();

    if (isStatic) {
      this.#clear();

      sorted.forEach((p, i) => {
        const entry = this.#makeRow(p, self, p.username === bestP?.username, i * 25);
        this.#el.appendChild(entry.el);
        this.#rows.set(p.username, entry);
      });

      return;
    }

    const isInitial = this.#rows.size === 0;
    const incoming  = new Set(sorted.map((p) => p.username));

    for (const [username, entry] of [...this.#rows]) {
      if (!incoming.has(username)) {
        this.#rows.delete(username);
        entry.el.remove();
      }
    }

    sorted.forEach((p, i) => {
      const isBest = p.username === bestP?.username;

      if (this.#rows.has(p.username)) {
        this.#updateRow(this.#rows.get(p.username), p, isBest);
      } else {
        const delay = isInitial ? i * 25 : 0;
        const entry = this.#makeRow(p, self, isBest, delay);
        this.#rows.set(p.username, entry);
      }
    });

    const currentOrder = [...this.#rows.keys()];
    const newOrder     = sorted.map((p) => p.username);
    const sameOrder    = currentOrder.length === newOrder.length &&
      currentOrder.every((u, i) => u === newOrder[i]);

    if (!sameOrder) {
      sorted.forEach((p) => this.#el.appendChild(this.#rows.get(p.username).el));
    }
  }
}