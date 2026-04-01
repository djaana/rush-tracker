const { app, BrowserWindow, Tray, Menu, nativeImage, Notification } = require('electron');
const { join } = require('path');

require('dotenv').config({
  path: app.isPackaged ? join(process.resourcesPath, '.env') : join(__dirname, '.env'),
  quiet: true
});

const LogWatcher = require('./src/classes/LogWatcher');
const LogHandler = require('./src/classes/LogHandler');
const Store = require('./src/classes/Store');
const Settings = require('./src/classes/Settings');
const Updater = require('./src/classes/Updater');
const IpcHandler = require('./src/classes/IpcHandler');
const ApiClient = require('./src/classes/ApiClient');

const iconPath = app.isPackaged ? join(process.resourcesPath, 'app.ico') : join(__dirname, 'app.ico');
const gotLock = app.requestSingleInstanceLock();

const store = new Store();
const settings = new Settings(join(process.env.APPDATA, process.env.STORE_DIR));
const handler = new LogHandler(store);
const updater = new Updater(iconPath);
const apiClient = new ApiClient(join(process.env.APPDATA, process.env.STORE_DIR));

let mainWindow;
let tray;
let quit;
let notif;
let pendingUpdate = null;

if (!gotLock) return app.quit();

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

function sendUpdate() {
  apiClient.setSelf(handler.self);

  mainWindow?.webContents.send('game:update', {
    game: handler.game,
    self: handler.self,
    games: store.read()
  });
}

function sendNotification(message, sub) {
  mainWindow?.webContents.send('notification:push', { message, sub });
}

function createTray() {
  if (tray) return;

  const img = nativeImage.createFromPath(iconPath);
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('rush tracker');
  const menu = Menu.buildFromTemplate([{ label: 'quitter', click: () => {
    quit = true;
    app.quit();
  }}]);

  tray.setContextMenu(menu);
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820, height: 520,
    minWidth: 820, minHeight: 520,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a1a',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(join(__dirname, 'src', 'renderer', 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    sendUpdate();

    if (pendingUpdate) {
      mainWindow.webContents.send('update:available', pendingUpdate);
      pendingUpdate = null;
    }
  });

  mainWindow.on('close', (e) => {
    if (quit || !settings.get('tray')) return app.quit();

    e.preventDefault();
    mainWindow.hide();

    if (!notif) {
      notif = true;

      new Notification({
        title: 'rush tracker',
        body: 'le logiciel tourne toujours en arrière-plan',
        icon: iconPath
      }).show();
    }
  });

  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (!app.isPackaged) return;
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) e.preventDefault();
  });

  mainWindow.webContents.on('devtools-opened', () => {
    if (!app.isPackaged) return;
    mainWindow.webContents.closeDevTools();
  });
}

app.whenReady().then(async () => {
  await apiClient.init().catch(() => {});

  createWindow();

  if (settings.get('tray')) createTray();

  const watcher = new LogWatcher(join(process.env.APPDATA, process.env.LOG_SUBPATH));
  watcher.on('log:update', async (logs) => {
    for (const log of logs) {
      await handler.parse(log);
    }

    sendUpdate();
  });

  handler.on('game:saved', sendUpdate);
  handler.on('notification:push', ({ message, sub }) => sendNotification(message, sub));
  updater.on('update:available', ({ version, downloadUrl }) => {
    if (!mainWindow?.webContents.isLoading()) {
      mainWindow?.webContents.send('update:available', { version, downloadUrl });
    } else {
      pendingUpdate = { version, downloadUrl };
    }
  });

  updater.start();
  watcher.start();

  new IpcHandler(
    () => mainWindow,
    handler,
    sendUpdate,
    store,
    sendNotification,
    settings,
    updater,
    { createTray, destroyTray },
    apiClient
  );

  app.on('second-instance', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  app.on('before-quit', () => {
    watcher.stop();
    updater.stop();
  });
});

app.on('window-all-closed', () => {});