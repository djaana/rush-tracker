import { kd } from './utils.js';

export default class Players {
    #el;

    constructor(onPlayerClick) {
        this.#el = document.getElementById('player-rows');

        this.#el.addEventListener('click', (e) => {
            const row = e.target.closest('.row');
            if (row) onPlayerClick(row.dataset.username);
        });
    };

    render(players, self) {
        if (!players?.length) return this.#el.innerHTML = '<div class="empty-state">en attente des joueurs...</div>';

        const kdVal   = (p) => p.deaths === 0 ? p.kills : p.kills / p.deaths;
        const best    = players.reduce((a, b) => kdVal(b) > kdVal(a) ? b : a);

        const teamOrder    = { blue: 0, red: 1 };
        const getTeamOrder = (t) => t in teamOrder ? teamOrder[t] : 2;

        const sorted = [...players].sort((a, b) => {
            const tDiff = getTeamOrder(a.team) - getTeamOrder(b.team);
            if (tDiff !== 0) return tDiff;

            const kdDiff = kdVal(b) - kdVal(a);
            if (kdDiff !== 0) return kdDiff;

            return a.username.localeCompare(b.username);
        });

        this.#el.innerHTML = sorted.map((p) => {
            const teamClass      = p.team || 'none';
            const selfClass      = (p.self || p.username === self) ? 'self' : '';
            const connectionClass = p.connection === true ? 'connected' : p.connection === false ? 'disconnected' : '';
            const crown          = best.kills > 0 && p.username === best.username ? '<span class="crown">👑</span>' : '';
            const breaker        = p.breaker ? '<span class="breaker">💥</span>' : '';

            return `
                <div class="row ${connectionClass}" data-username="${p.username}">
                    <img
                        class="player-head ${selfClass}"
                        src="https://mc-heads.net/avatar/${p.username}"
                        onerror="this.style.opacity='0'"
                    />
                    <span class="player-name ${teamClass}">${p.username} ${crown} ${breaker}</span>
                    <div class="player-stats">
                        <span class="stat-k">${p.kills}</span>
                        <span class="stat-d">${p.deaths}</span>
                        <span class="stat-kd">${kd(p.kills, p.deaths)}</span>
                    </div>
                </div>
            `;
        }).join('');
    };
};