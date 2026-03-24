import { kd, fmtPoints, fmtTime } from './utils.js';

export default class PlayerModal {
    #overlay;
    #headEl;
    #nameEl;
    #profileBtn;

    constructor() {
        this.#overlay    = document.getElementById('player-modal');
        this.#headEl     = document.getElementById('pm-head');
        this.#nameEl     = document.getElementById('pm-name');
        this.#profileBtn = document.getElementById('pm-profile-btn');

        this.#overlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.close();
        });
        
        document.getElementById('pm-close-btn').addEventListener('click', () => this.close());
    };

    #setState(state) {
        document.getElementById('pm-loading').style.display = state === 'loading' ? '' : 'none';
        document.getElementById('pm-error').style.display   = state === 'error'   ? '' : 'none';
        document.getElementById('pm-content').style.display = state === 'content' ? '' : 'none';
    };

    async show(username) {
        this.#headEl.style.opacity = '';
        this.#headEl.src           = `https://mc-heads.net/avatar/${username}`;
        this.#nameEl.textContent   = username;
        this.#profileBtn.onclick   = () => {
            window.api?.openExternal(`https://www.fancraft.eu/joueur?name=${username}`);
        };

        this.#overlay.classList.add('open');
        this.#setState('loading');

        const data = await window.api.fetchPlayer(username);
        const rush = data?.stats?.periods?.global?.rush;

        if (!rush) return this.#setState('error');

        const winrate = rush.gamesPlayed > 0
            ? ((rush.wins / rush.gamesPlayed) * 100).toFixed(1)
            : 0;

        document.getElementById('pm-winrate').textContent = `${winrate}%`;
        document.getElementById('pm-kd').textContent      = kd(rush.kills, rush.deaths);
        document.getElementById('pm-points').textContent  = fmtPoints(rush.points);
        document.getElementById('pm-played').textContent  = rush.gamesPlayed.toLocaleString('fr-FR');
        document.getElementById('pm-wins').textContent    = rush.wins.toLocaleString('fr-FR');
        document.getElementById('pm-losses').textContent  = rush.losses.toLocaleString('fr-FR');
        document.getElementById('pm-kills').textContent   = rush.kills.toLocaleString('fr-FR');
        document.getElementById('pm-deaths').textContent  = rush.deaths.toLocaleString('fr-FR');
        document.getElementById('pm-ks').textContent  = rush.currentKillStreak.toLocaleString('fr-FR');
        document.getElementById('pm-time').textContent    = `${fmtTime(rush.timePlayed)}h`;
        
        this.#setState('content');
    };

    close() {
        this.#overlay.classList.remove('open');
    };
};