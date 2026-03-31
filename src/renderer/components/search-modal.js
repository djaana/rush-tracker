export default class SearchModal {
  #overlay;
  #input;
  #results;
  #onPlayerClick;

  constructor(onPlayerClick) {
    this.#overlay = document.getElementById('search-modal');
    this.#input = document.getElementById('srch-input');
    this.#results = document.getElementById('srch-results');
    this.#onPlayerClick = onPlayerClick;

    this.#overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    document.getElementById('btn-search-close').addEventListener('click', () => this.close());

    this.#input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.#search();
    });
  }

  async #search() {
    const username = this.#input.value.trim();
    if (!username) return;

    this.#setState('loading');

    const res = await window.api.searchPlayers(username);
    const code = res?.code;

    switch(code) {
      case 200:
        break;
      case 429:
        return this.#setState('ratelimit');
      default:
        return this.#setState('error');
    }

    const results = res?.data;
    if (!results.length) return this.#setState('empty');


    this.#results.innerHTML = '';

    results.forEach((username) => {
      const row = document.createElement('div');
      row.className = 'srch-row';
      row.innerHTML = `
        <img class="srch-avatar" src="https://mc-heads.net/avatar/${username}" onerror="this.style.opacity='0'" />
        <span class="srch-name">${username}</span>
      `;
      row.addEventListener('click', () => {
        this.close();
        this.#onPlayerClick(username);
      });

      this.#results.appendChild(row);
    });

    this.#setState('results');
  }

  #setState(state) {
    const states = [
      'loading',
      'empty',
      'ratelimit',
      'error',
      'results'
    ];

    states.forEach((s) => {
      const el = document.getElementById(`srch-${s}`);
      if (!el) return;

      el.style.display = s === state ? '' : 'none';
    });
  }

  open() {
    this.#input.value = '';
    this.#results.innerHTML = '';
    this.#setState('results');
    this.#overlay.classList.add('open');
    requestAnimationFrame(() => this.#input.focus());
  }

  close() {
    this.#overlay.classList.remove('open');
  }
};