export default class SearchModal {
  #overlay;
  #input;
  #results;
  #onPlayerClick;

  constructor(onPlayerClick) {
    this.#overlay      = document.getElementById('search-modal');
    this.#input        = document.getElementById('srch-input');
    this.#results      = document.getElementById('srch-results');
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

    const results = await window.api.searchPlayers(username);

    if (!results?.length) {
      this.#setState('empty');
      return;
    }

    this.#results.innerHTML = '';

    results.forEach(({ name }) => {
      const row = document.createElement('div');
      row.className = 'srch-row';
      row.innerHTML = `
        <img class="srch-avatar" src="https://mc-heads.net/avatar/${name}" onerror="this.style.opacity='0'" />
        <span class="srch-name">${name}</span>
      `;
      row.addEventListener('click', () => {
        this.close();
        this.#onPlayerClick(name);
      });
      this.#results.appendChild(row);
    });

    this.#setState('results');
  }

  #setState(state) {
    document.getElementById('srch-loading').style.display = state === 'loading' ? '' : 'none';
    document.getElementById('srch-empty').style.display   = state === 'empty'   ? '' : 'none';
    this.#results.style.display                            = state === 'results' ? '' : 'none';
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
}