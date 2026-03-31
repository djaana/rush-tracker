export default class UpdateModal {
  #overlay;
  #headerTitle;
  #versionEl;
  #stateAvailable;
  #stateProgress;
  #stateDone;
  #stateError;
  #barFill;
  #percentEl;
  #etaEl;
  #downloadUrl = null;
  #canClose = true;

  constructor() {
    this.#overlay = document.getElementById('update-modal');
    this.#headerTitle = this.#overlay.querySelector('.modal-header span');
    this.#versionEl = document.getElementById('upd-version');
    this.#stateAvailable = document.getElementById('upd-state-available');
    this.#stateProgress = document.getElementById('upd-state-progress');
    this.#stateDone = document.getElementById('upd-state-done');
    this.#stateError = document.getElementById('upd-state-error');
    this.#barFill = document.getElementById('upd-bar-fill');
    this.#percentEl = document.getElementById('upd-percent');
    this.#etaEl = document.getElementById('upd-eta');

    this.#overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    document.getElementById('btn-update-close').addEventListener('click', () => this.close());
    document.getElementById('upd-ignore').addEventListener('click', () => this.close());
    document.getElementById('upd-install').addEventListener('click', () => this.#startInstall());
    document.getElementById('upd-manual').addEventListener('click', () => {
      window.api.openExternal(this.#downloadUrl);
    });

    window.api.onDownloadProgress(({ percent, eta }) => this.#onProgress(percent, eta));
    window.api.onUpdateError(() => this.#onError());
  }

  #setState(state) {
    this.#stateAvailable.style.display = state === 'available' ? '' : 'none';
    this.#stateProgress.style.display = state === 'progress' ? '' : 'none';
    this.#stateDone.style.display = state === 'done' ? '' : 'none';
    this.#stateError.style.display = state === 'error' ? '' : 'none';
  }

  #onError() {
    this.#canClose = true;
    this.#headerTitle.textContent = 'échec de la mise à jour';
    this.#setState('error');
  }

  #startInstall() {
    if (!this.#downloadUrl) return;

    this.#canClose = false;
    this.#headerTitle.textContent = 'téléchargement en cours';
    this.#barFill.style.width = '0%';
    this.#percentEl.textContent = '0%';
    this.#etaEl.textContent = '—';

    this.#setState('progress');

    window.api.installUpdate(this.#downloadUrl);
  }

  #onProgress(percent, eta) {
    if (percent >= 1) {
      this.#headerTitle.textContent = 'installation en cours';
      this.#setState('done');
      return;
    }

    const pct = Math.round(percent * 100);
    this.#barFill.style.width = `${pct}%`;
    this.#percentEl.textContent = `${pct}%`;
    this.#etaEl.textContent = this.#fmtEta(eta);
  }

  #fmtEta(seconds) {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  show(version, downloadUrl) {
    this.#downloadUrl = downloadUrl;
    this.#canClose = true;
    this.#versionEl.textContent = version;
    this.#headerTitle.textContent = 'mise à jour disponible';

    this.#setState('available');
    this.#overlay.classList.add('open');
  }

  close() {
    if (!this.#canClose) return;
    this.#overlay.classList.remove('open');
  }
};