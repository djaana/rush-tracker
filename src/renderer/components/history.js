import { formatDate, startOfToday, startOfWeekAgo, startOfMonthAgo } from './utils.js';

export default class History {
  #el;
  #cards = new Map();
  #isFirst = true;
  #filterMode = null;
  #filterResult = null;
  #filterDate = null;
  #lastGame = null;
  #lastGames = [];
  #lastViewing = null;

  constructor(onSelect, onContextMenu) {
    this.#el = document.getElementById('history-cards');

    this.#el.addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      onSelect(id === 'current' ? 'current' : Number(id));
    });

    this.#el.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const id = card.dataset.id;
      onContextMenu(e, id === 'current' ? 'current' : Number(id));
    });

    document.getElementById('filter-mode').addEventListener('change', (e) => {
      this.#filterMode = e.target.value || null;
      this.#rerender();
    });

    document.getElementById('filter-result').addEventListener('change', (e) => {
      this.#filterResult = e.target.value || null;
      this.#rerender();
    });

    document.getElementById('filter-date').addEventListener('change', (e) => {
      this.#filterDate = e.target.value || null;
      this.#rerender();
    });
  }

  #filterGames(games) {
    return games.filter((g) => {
      if (this.#filterMode && g.mode?.name !== this.#filterMode) return false;
      if (this.#filterResult && g.state !== this.#filterResult) return false;
      if (this.#filterResult && g.mode?.name === 'spectator') return false;

      if (this.#filterDate) {
        const ts = g.id;

        if (this.#filterDate === 'today' && ts < startOfToday())    return false;
        if (this.#filterDate === 'week'  && ts < startOfWeekAgo())  return false;
        if (this.#filterDate === 'month' && ts < startOfMonthAgo()) return false;
      }

      return true;
    });
  }

  #rerender() {
    if (this.#lastGame === null) return;
    this.#renderInternal(this.#lastGame, this.#lastGames, this.#lastViewing, false);
  }

  #buildCurrentCard(game) {
    const el = document.createElement('div');

    el.dataset.id = 'current';
    el.innerHTML = `
      <div class="card-top">
        <span class="card-title">${game.mode?.label || '—'}</span>
        <span class="badge yellow">en cours</span>
      </div>
    `;

    return el;
  }

  #buildCard(g) {
    const el = document.createElement('div');
    el.dataset.id = String(g.id);

    const modeLabel = g.mode?.label || '—';
    let resultLabel, resultClass;

    if (g.spectator) {
      const labels = { blue: 'bleu', red: 'rouge' };

      resultLabel = labels[g.winner] || '—';
      resultClass = g.winner         || 'muted';
    } else {
      const labels = { win: 'victoire', loose: 'défaite', draw: 'égalité' };
      const classes = { win: 'green', loose: 'red' };

      resultLabel = labels[g.state]  || 'inconnu';
      resultClass = classes[g.state] || 'muted';
    }

    el.innerHTML = `
      <div class="card-top">
        <span class="card-title">${modeLabel}</span>
        <span class="card-date">${formatDate(g.id)}</span>
      </div>
      <div class="card-bottom">
        <span class="card-sub ${resultClass}">${resultLabel}</span>
        <span class="card-time">${g.duration || '—'}</span>
      </div>
    `;

    return el;
  }

  #setClass(el, id, viewingGameId) {
    if (id === 'current') {
      el.className = `card current${viewingGameId === null ? ' selected' : ''}`;
    } else {
      el.className = `card${viewingGameId === Number(id) ? ' selected' : ''}`;
    }
  }

  render(game, games, viewingGameId) {
    this.#lastGame = game;
    this.#lastGames = games;
    this.#lastViewing = viewingGameId;
    this.#renderInternal(game, games, viewingGameId, true);
  }

  #renderInternal(game, games, viewingGameId, animate = true) {
    const isFirst = animate && this.#isFirst;
    if (animate) this.#isFirst = false;

    const filteredGames = this.#filterGames(games);

    const incoming = new Map();
    if (game.started) incoming.set('current', game);
    for (const g of filteredGames) incoming.set(String(g.id), g);

    for (const [id, el] of [...this.#cards]) {
      if (!incoming.has(id)) {
        this.#cards.delete(id);

        if (animate) {
          el.classList.add('card-exit');
          el.addEventListener('animationend', () => el.remove(), { once: true });
        } else {
          el.remove();
        }
      }
    }

    this.#el.querySelector('.history-empty')?.remove();

    const incomingKeys = [...incoming.keys()];
    let newIdx = 0;

    for (let i = 0; i < incomingKeys.length; i++) {
      const id = incomingKeys[i];
      const data = incoming.get(id);

      if (this.#cards.has(id)) {
        this.#setClass(this.#cards.get(id), id, viewingGameId);
      } else {
        const el = id === 'current' ? this.#buildCurrentCard(data) : this.#buildCard(data);

        this.#setClass(el, id, viewingGameId);

        if (animate) {
          el.classList.add('card-enter');
          if (isFirst) el.style.animationDelay = `${newIdx * 40}ms`;
        }

        let anchor = null;
        for (let j = i + 1; j < incomingKeys.length; j++) {
          const next = this.#cards.get(incomingKeys[j]);
          if (next) {
            anchor = next;
            break;
          }
        }

        anchor ? this.#el.insertBefore(el, anchor) : this.#el.appendChild(el);

        this.#cards.set(id, el);
        newIdx++;
      }
    }

    if (!incoming.size) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'aucune partie enregistrée';
      this.#el.appendChild(empty);
    }
  }
}