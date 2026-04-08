import Sidebar from './components/sidebar.js';
import Players from './components/players.js';
import History from './components/history.js';
import PlayerModal from './components/player-modal.js';
import ContextMenu from './components/context-menu.js';
import InfoModal from './components/info-modal.js';
import Notifier from './components/notification.js';
import SettingsModal from './components/settings-modal.js';
import SearchModal from './components/search-modal.js';
import UpdateModal from './components/update-modal.js';

let lastData = null;
let viewingGameId = null;
let settings = null;

const playerModal = new PlayerModal();
const infoModal = new InfoModal();
const settingsModal = new SettingsModal();
const updateModal = new UpdateModal();
const searchModal = new SearchModal((username) => playerModal.show(username));
const notifier = new Notifier(() => settings?.notifications !== false);

const contextMenu = new ContextMenu(
  () => window.api.stopGame(),
  (id) => {
    window.api.deleteGame(id);
    if (viewingGameId === id) viewingGameId = null;
  },
  () => notifier.push('copié dans le presse-papier')
);

const history = new History(
  (id) => id === 'current' ? viewCurrent() : selectGame(id),
  (e, id) => {
    const game = id !== 'current' ? (lastData?.games || []).find((g) => g.id === id) : null;
    contextMenu.showForGame(e, id, game);
  }
);

const players = new Players(
  (username) => playerModal.show(username),
  (e, player, allPlayers) => contextMenu.showForPlayer(e, player, allPlayers)
);

const sidebar = new Sidebar(() => viewCurrent());

function applyAnimations(enabled) {
  document.body.classList.toggle('no-animations', !enabled);
}

function getEtat(game) {
  if (game.started) return 'en partie';
  if (game.lobby) return 'lobby';
  if (game.mode) return 'file d\'attente';

  return 'hub';
}

function getPlayers() {
  window.api.fetchPlayers().then((res) => {
    const el = document.getElementById('s-players');

    const code = res?.code;
    if (code !== 200) return el.textContent = '—';

    const data = res?.data;

    document.getElementById('s-players').textContent = data?.players;
  });
}

function refresh() {
  if (!lastData) return;

  const { game, self, games } = lastData;

  if (!viewingGameId) {
    players.render(game.players, self, false);
  } else {
    const saved = (games || []).find((g) => g.id === viewingGameId);
    if (saved) players.render(saved.players.map((p) => ({ ...p, connection: true })), null, true, viewingGameId);
  }

  history.render(game, games || [], viewingGameId);
  sidebar.setActive(!viewingGameId);
}

function viewCurrent() {
  viewingGameId = null;
  refresh();
}

function selectGame(id) {
  viewingGameId = (viewingGameId === id) ? null : id;
  refresh();
}

document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());
document.getElementById('btn-settings').addEventListener('click', () => settingsModal.open());
document.getElementById('btn-search').addEventListener('click', () => searchModal.open());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    infoModal.close();
    playerModal.close();
    settingsModal.close();
    searchModal.close();
    updateModal.close();
    contextMenu.hide();
  }

  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    window.api.simStart();
  }
});

window.api.getVersion().then((v) => {
  document.getElementById('s-version').textContent = v;
});

window.api.getSettings().then((s) => {
  settings = s;
  applyAnimations(s.animations);
});

window.api.onSettingsUpdate((updated) => {
  settings = updated;
  applyAnimations(updated.animations);
});

window.api.onUpdateAvailable(({ version, downloadUrl }) => {
  updateModal.show(version, downloadUrl);
});

window.api.onGameUpdate((data) => {
  lastData = data;

  const { game, self } = data;
  const games = data.games || [];

  document.getElementById('s-pseudo').textContent = self || '—';
  document.getElementById('s-mode').textContent = game.mode?.name || '—';
  document.getElementById('s-etat').textContent = getEtat(game);

  if (viewingGameId !== null && !games.some((g) => g.id === viewingGameId)) {
    viewingGameId = null;
  }

  refresh();
});

window.api.onNotification(({ message, sub }) => notifier.push(message, sub));

getPlayers();
setInterval(() => getPlayers(), 10000);
