export default class ContextMenu {
    #el;
    #stopBtn;
    #deleteBtn;
    #targetId  = null;
    #isCurrent = false;

    constructor(onStop, onDelete) {
        this.#el        = document.getElementById('ctx-menu');
        this.#stopBtn   = document.getElementById('ctx-stop');
        this.#deleteBtn = document.getElementById('ctx-delete');

        this.#stopBtn.addEventListener('click', () => {
            onStop();
            this.hide();
        });

        this.#deleteBtn.addEventListener('click', () => {
            if (this.#targetId !== null) onDelete(this.#targetId);
            this.hide();
        });

        document.addEventListener('click',       ()  => this.hide());
        document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.card')) this.hide(); });
    };

    show(e, id) {
        e.preventDefault();
        e.stopPropagation();

        this.#isCurrent = (id === 'current');
        this.#targetId  = this.#isCurrent ? null : id;

        this.#stopBtn.style.display   = this.#isCurrent ? ''     : 'none';
        this.#deleteBtn.style.display = this.#isCurrent ? 'none' : '';

        this.#el.style.left = `${e.clientX}px`;
        this.#el.style.top  = `${e.clientY}px`;
        this.#el.classList.add('open');

        const rect = this.#el.getBoundingClientRect();
        const x = Math.min(e.clientX, window.innerWidth  - rect.width  - 4);
        const y = Math.min(e.clientY, window.innerHeight - rect.height - 4);

        this.#el.style.left = `${Math.max(4, x)}px`;
        this.#el.style.top  = `${Math.max(4, y)}px`;
    };

    hide() {
        this.#el.classList.remove('open');
        this.#targetId  = null;
        this.#isCurrent = false;
    };
};