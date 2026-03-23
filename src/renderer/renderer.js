import Sidebar      from './components/sidebar.js';
import Players      from './components/players.js';
import History      from './components/history.js';
import PlayerModal  from './components/player-modal.js';
import ContextMenu  from './components/context-menu.js';
import InfoModal    from './components/info-modal.js';

let lastData      = null;
let viewingGameId = null;

const playerModal = new PlayerModal();
const infoModal   = new InfoModal();

const contextMenu = new ContextMenu(
    ()   => window.api.stopGame(),
    (id) => {
        window.api.deleteGame(id);
        if (viewingGameId === id) viewingGameId = null;
    }
);

const history = new History(
    (id) => id === 'current' ? viewCurrent() : selectGame(id),
    (e, id) => contextMenu.show(e, id)
);

const players = new Players((username) => playerModal.show(username));
const sidebar = new Sidebar(() => viewCurrent());

function getEtat(game) {
    if (game.started) return 'en partie';
    if (game.lobby)   return 'lobby';
    if (game.mode)    return 'file d\'attente';

    return 'hub';
};

function refresh() {
    if (!lastData) return;

    const { game, self, games } = lastData;

    if (viewingGameId === null) {
        players.render(game.players, self, false);
    } else {
        const saved = (games || []).find((g) => g.id === viewingGameId);
        if (saved) players.render(saved.players.map((p) => ({ ...p, connection: true })), null, true, viewingGameId);
    };

    history.render(game, games || [], viewingGameId);
    sidebar.setActive(viewingGameId === null);
};

function viewCurrent() {
    viewingGameId = null;
    refresh();
};

function selectGame(id) {
    viewingGameId = (viewingGameId === id) ? null : id;
    refresh();
};

document.getElementById('btn-minimize').addEventListener('click', () => window.api?.minimize());
document.getElementById('btn-close').addEventListener('click',    () => window.api?.close());

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        infoModal.close();
        playerModal.close();
        contextMenu.hide();
    };

    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        window.api?.simStart();
    };
});

window.api?.getVersion().then((v) => {
    document.getElementById('s-version').textContent = v;
});

if (window.api) {
    window.api.onGameUpdate((data) => {
        lastData = data;

        const { game, self } = data;
        const games = data.games || [];

        document.getElementById('s-pseudo').textContent = self || '—';
        document.getElementById('s-mode').textContent   = game.mode?.name || '—';
        document.getElementById('s-etat').textContent   = getEtat(game);

        if (viewingGameId !== null && !games.some((g) => g.id === viewingGameId)) {
            viewingGameId = null;
        };

        refresh();
    });
};