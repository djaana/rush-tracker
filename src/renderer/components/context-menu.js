import { exportPlayerLine, exportGame, bestPlayer } from './utils.js';

export default class ContextMenu {
  #el;
  #stopBtn;
  #deleteBtn;
  #exportBtn;
  #exportFn = null;
  #onNotify;
  #targetId = null;
  #isCurrent = false;

  constructor(onStop, onDelete, onNotify) {
    this.#el = document.getElementById('ctx-menu');
    this.#stopBtn = document.getElementById('ctx-stop');
    this.#deleteBtn = document.getElementById('ctx-delete');
    this.#exportBtn = document.getElementById('ctx-export');
    this.#onNotify = onNotify;

    this.#stopBtn.addEventListener('click', () => {
      onStop();
      this.hide();
    });

    this.#deleteBtn.addEventListener('click', () => {
      if (this.#targetId !== null) onDelete(this.#targetId);
      this.hide();
    });

    this.#exportBtn.addEventListener('click', () => {
      this.#exportFn?.();
      this.#onNotify?.();
      this.hide();
    });

    document.addEventListener('click', () => this.hide());
    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.card') && !e.target.closest('.row')) this.hide();
    });
  }

  showForGame(e, id, game) {
    e.preventDefault();
    e.stopPropagation();

    this.#isCurrent = (id === 'current');
    this.#targetId = this.#isCurrent ? null : id;

    this.#stopBtn.style.display = this.#isCurrent ? '' : 'none';
    this.#deleteBtn.style.display = this.#isCurrent ? 'none' : '';
    this.#exportBtn.style.display = game ? '' : 'none';
    this.#exportFn = game ? () => navigator.clipboard.writeText(exportGame(game)) : null;

    this.#position(e);
  }

  showForPlayer(e, player, allPlayers) {
    e.preventDefault();
    e.stopPropagation();

    this.#targetId = null;
    this.#isCurrent = false;

    this.#stopBtn.style.display = 'none';
    this.#deleteBtn.style.display = 'none';
    this.#exportBtn.style.display = '';
    this.#exportFn = () => {
      const best = bestPlayer(allPlayers);
      navigator.clipboard.writeText(exportPlayerLine(player, player.username === best?.username));
    };

    this.#position(e);
  }

  #position(e) {
    this.#el.style.left = `${e.clientX}px`;
    this.#el.style.top = `${e.clientY}px`;
    this.#el.classList.add('open');

    const rect = this.#el.getBoundingClientRect();
    const x = Math.min(e.clientX, window.innerWidth - rect.width - 4);
    const y = Math.min(e.clientY, window.innerHeight - rect.height - 4);

    this.#el.style.left = `${Math.max(4, x)}px`;
    this.#el.style.top = `${Math.max(4, y)}px`;
  }

  hide() {
    this.#el.classList.remove('open');
    this.#targetId = null;
    this.#isCurrent = false;
    this.#exportFn = null;
  }
}