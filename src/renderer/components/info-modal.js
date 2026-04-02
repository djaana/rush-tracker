export default class InfoModal {
  #overlay;

  constructor() {
    this.#overlay = document.getElementById('modal');

    this.#overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    document.getElementById('btn-info').addEventListener('click', () => this.open());
    document.getElementById('btn-modal-close').addEventListener('click', () => this.close());
    document.getElementById('link-discord').addEventListener('click', () => {
      window.api.openExternal('https://discord.gg/mWF6wqARdP');
    });
    document.getElementById('link-github').addEventListener('click', () => {
      window.api.openExternal('https://github.com/rushtracker/app');
    });
  }

  open() {
    this.#overlay.classList.add('open');
  }

  close() {
    this.#overlay.classList.remove('open');
  }
}