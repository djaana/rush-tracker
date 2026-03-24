const DURATION = 5000;

const MESSAGES = {
    spectator:    { message: 'mode spectateur',             sub: null },
    started:      { message: 'partie commencée',            sub: null },
    saved:        { message: 'partie enregistrée',          sub: null },
    deleted:      { message: 'partie supprimée',            sub: null },
    lobby:        { message: 'partie détectée',             sub: null },
    bedDestroyed: (d) => ({ message: 'lit adverse détruit', sub: d.username ? `par ${d.username}` : null }),
};

export default class Notifier {
    #container;

    constructor() {
        this.#container = document.getElementById('notif-container');
    }

    push(type, data = {}) {
        const entry = MESSAGES[type];
        if (!entry) return;

        const { message, sub } = typeof entry === 'function' ? entry(data) : entry;

        this.#spawn(message, sub);
    }

    #spawn(message, sub) {
        const el = document.createElement('div');
        el.className = 'notif notif-enter';
        el.innerHTML = `
            <button class="notif-close">✕</button>
            <div class="notif-body">
                <span class="notif-message">${message}</span>
                ${sub ? `<div class="notif-sub">${sub}</div>` : ''}
            </div>
            <div class="notif-bar"><div class="notif-bar-fill"></div></div>
        `;

        el.addEventListener('animationend', () => el.classList.remove('notif-enter'), { once: true });

        this.#container.prepend(el);

        const fill  = el.querySelector('.notif-bar-fill');
        const close = el.querySelector('.notif-close');

        let elapsed = 0;
        let start   = null;
        let rafId   = null;
        let done    = false;

        const dismiss = () => {
            if (done) return;
            done = true;
            cancelAnimationFrame(rafId);
            el.classList.add('notif-exit');
            el.addEventListener('animationend', () => el.remove(), { once: true });
        }

        const tick = (ts) => {
            if (start === null) start = ts - elapsed;
            elapsed = ts - start;

            fill.style.transform = `scaleX(${Math.max(0, 1 - elapsed / DURATION)})`;

            if (elapsed >= DURATION) return dismiss();

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        el.addEventListener('mouseenter', () => cancelAnimationFrame(rafId));
        el.addEventListener('mouseleave', () => {
            if (done) return;

            start = null;
            rafId = requestAnimationFrame(tick);
        });

        close.addEventListener('click', () => dismiss());
    }
}