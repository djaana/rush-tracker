export default class SettingsModal {
  #overlay;
  #settings = {};

  constructor() {
    this.#overlay = document.getElementById('settings-modal');

    this.#overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    document.getElementById('btn-settings-close').addEventListener('click', () => this.close());
    document.getElementById('st-open-data').addEventListener('click', () => window.api.openDataFolder());

    ['notifications', 'tray', 'animations'].forEach((key) => {
      document.getElementById(`st-${key}`).addEventListener('click', () => this.#toggle(key));
    });
  }

  async #toggle(key) {
    const updated = await window.api.setSetting(key, !this.#settings[key]);
    this.#apply(updated);
  }

  #apply(settings) {
    this.#settings = settings;
    ['notifications', 'tray', 'animations'].forEach((key) => {
      const btn = document.getElementById(`st-${key}`);
      btn.classList.toggle('active', settings[key]);
      btn.querySelector('.toggle-state').textContent = settings[key] ? 'activé' : 'désactivé';
    });
  }

  async open() {
    const settings = await window.api.getSettings();
    this.#apply(settings);
    this.#overlay.classList.add('open');
  }

  close() {
    this.#overlay.classList.remove('open');
  }
};