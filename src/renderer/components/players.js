import { kd } from './utils.js';

export default class Players {
    #el;
    #rows = new Map();
    #gen  = 0;

    constructor(onPlayerClick) {
        this.#el = document.getElementById('player-rows');
        this.#el.addEventListener('click', (e) => {
            const row = e.target.closest('.row');
            if (row) onPlayerClick(row.dataset.username);
        });
    };

    #kdVal(p) {
        return p.deaths === 0 ? p.kills : p.kills / p.deaths;
    };

    #sort(players) {
        const order = { blue: 0, red: 1 };

        return [...players].sort((a, b) => {
            const td  = (order[a.team] ?? 2) - (order[b.team] ?? 2);
            if (td  !== 0) return td;

            const kdd = this.#kdVal(b) - this.#kdVal(a);
            if (kdd !== 0) return kdd;
            
            return a.username.localeCompare(b.username);
        });
    };

    #best(players) {
        return players.reduce((a, b) => this.#kdVal(b) > this.#kdVal(a) ? b : a);
    };

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

        return el;
    };

    #updateRow(el, p, isBest) {
        el.className = `row${p.connection === false ? ' disconnected' : ''}`;

        const crown   = isBest && p.kills > 0 ? ' <span class="crown">👑</span>' : '';
        const breaker = p.breaker ? ' <span class="breaker">💥</span>' : '';
        const nameEl  = el.querySelector('.player-name');

        nameEl.className = `player-name ${p.team || 'none'}`;
        nameEl.innerHTML = `${p.username}${crown}${breaker}`;

        el.querySelector('.stat-k').textContent  = p.kills;
        el.querySelector('.stat-d').textContent  = p.deaths;
        el.querySelector('.stat-kd').textContent = kd(p.kills, p.deaths);
    };

    #exitRow(el, cb) {
        el.classList.remove('row-enter');
        el.classList.add('row-exit');
        el.addEventListener('animationend', cb, { once: true });
    };

    #showEmpty() {
        if (this.#el.querySelector('.empty-state')) return;
        const el = document.createElement('div');

        el.className = 'empty-state';
        el.textContent = 'en attente des joueurs...';

        this.#el.appendChild(el);
    };

    render(players, self, skipExit = false) {
        const gen = ++this.#gen;

        if (!players?.length) {
            if (skipExit) {
                this.#el.innerHTML = '';
                this.#rows.clear();
                this.#showEmpty();

                return;
            };

            if (!this.#rows.size) {
                this.#showEmpty();

                return;
            };

            const snapshot = [...this.#rows];
            this.#rows.clear();

            let pending = snapshot.length;

            for (const [, el] of snapshot) {
                this.#exitRow(el, () => {
                    el.remove();

                    if (gen !== this.#gen) return;
                    if (--pending === 0) this.#showEmpty();
                });
            };
            return;
        };

        const sorted = this.#sort(players);
        const bestP  = this.#best(sorted);

        this.#el.querySelector('.empty-state')?.remove();

        if (skipExit) {
            this.#el.innerHTML = '';
            this.#rows.clear();

            sorted.forEach((p, i) => {
                const el = this.#makeRow(p, self, p.username === bestP.username, i * 25);
                this.#el.appendChild(el);
                this.#rows.set(p.username, el);
            });

            return;
        };

        const incoming = new Set(sorted.map((p) => p.username));

        for (const [username, el] of [...this.#rows]) {
            if (!incoming.has(username)) {
                this.#rows.delete(username);
                this.#exitRow(el, () => el.remove());
            };
        };

        sorted.forEach((p) => {
            const isBest = p.username === bestP.username;
            
            if (this.#rows.has(p.username)) {
                this.#updateRow(this.#rows.get(p.username), p, isBest);
            } else {
                const el = this.#makeRow(p, self, isBest);

                this.#el.appendChild(el);
                this.#rows.set(p.username, el);
            };
        });
    };
};