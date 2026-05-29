const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog, Notification } = require('electron');
const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');

// ─── Auto-update ──────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', ({ version }) => {
    new Notification({
      title: 'FocusCode update available',
      body: `Version ${version} is downloading in the background…`,
    }).show();
    updateTray();
  });

  autoUpdater.on('update-downloaded', ({ version }) => {
    updateReady = true;
    updateTray(); // shows "Restart to update" in menu
    const choice = dialog.showMessageBoxSync({
      type: 'info',
      title: 'Update ready',
      message: `FocusCode ${version} is ready.`,
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
    });
    if (choice === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', () => { /* silently ignore in production */ });

  // Check on startup, then every 4 hours
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

// ─── State ────────────────────────────────────────────────────────────────────

let tray = null;
let codeWin = null;
let inputWin = null;
let failWin = null;
let currentCode = '';
let sessionActive = false;
let codeShowTimer = null;
let codeHideTimer = null;
let devFastMode = false;
let updateReady = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

function cooldownMs() {
  return devFastMode ? 20 * 1000 : 5 * 60 * 1000;
}

function bottomRight(w, h) {
  const { workArea: wa } = screen.getPrimaryDisplay();
  return { x: wa.x + wa.width - w - 16, y: wa.y + wa.height - h - 16 };
}

function makeWin(html, w, h) {
  const { x, y } = bottomRight(w, h);
  const win = new BrowserWindow({
    width: w, height: h, x, y,
    frame: false, alwaysOnTop: true, transparent: true,
    resizable: false, skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadFile(path.join(__dirname, html));
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver');
  return win;
}

function destroyWin(ref) {
  if (ref && !ref.isDestroyed()) ref.destroy();
}

function closeAll() {
  destroyWin(codeWin); codeWin = null;
  destroyWin(inputWin); inputWin = null;
  destroyWin(failWin);  failWin = null;
}

function clearTimers() {
  clearTimeout(codeShowTimer);
  clearTimeout(codeHideTimer);
}

// ─── Game loop ────────────────────────────────────────────────────────────────

function startCycle(delayMs) {
  clearTimers();
  currentCode = generateCode();
  codeShowTimer = setTimeout(showCode, delayMs);
}

function showCode() {
  closeAll();
  const duration = 20 * 1000;
  codeWin = makeWin('code-popup.html', 220, 185);
  codeWin.webContents.once('did-finish-load', () => {
    if (codeWin && !codeWin.isDestroyed()) codeWin.webContents.send('show-code', currentCode, duration);
  });
  codeWin.on('closed', () => { codeWin = null; });
  codeHideTimer = setTimeout(showInput, duration);
}

function showInput() {
  closeAll();
  inputWin = makeWin('input-popup.html', 220, 190);
  inputWin.webContents.once('did-finish-load', () => {
    if (inputWin && !inputWin.isDestroyed()) inputWin.webContents.send('start-timer');
  });
  inputWin.on('closed', () => { inputWin = null; });
}

function showFail() {
  closeAll();
  failWin = makeWin('fail-popup.html', 220, 175);
  failWin.on('closed', () => { failWin = null; });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'FocusCode', enabled: false },
    { label: sessionActive ? '● Active' : '○ Paused', enabled: false },
    ...(updateReady ? [
      { type: 'separator' },
      { label: '⬆ Restart to update', click: () => autoUpdater.quitAndInstall() },
    ] : []),
    { type: 'separator' },
    {
      label: sessionActive ? 'Pause Session' : 'Start Session',
      click: () => { sessionActive ? pauseSession() : startSession(); },
    },
    { type: 'separator' },
    {
      label: 'Dev',
      submenu: [
        {
          label: 'Fast mode (20s intervals)',
          type: 'checkbox',
          checked: devFastMode,
          click: (item) => { devFastMode = item.checked; },
        },
        { type: 'separator' },
        { label: 'Show code popup',  click: () => { currentCode = generateCode(); showCode(); } },
        { label: 'Show input popup', click: () => showInput() },
        { label: 'Show fail popup',  click: () => showFail() },
        { type: 'separator' },
        { label: `Current code: ${currentCode || '—'}`, enabled: false },
        { type: 'separator' },
        { label: 'Check for updates', click: () => autoUpdater.checkForUpdates().catch(() => {}) },
      ],
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function updateTray() {
  tray.setContextMenu(buildMenu());
  tray.setToolTip(`FocusCode — ${sessionActive ? 'Active' : 'Paused'}`);
}

function startSession() {
  sessionActive = true;
  updateTray();
  startCycle(0);
}

function pauseSession() {
  sessionActive = false;
  clearTimers();
  closeAll();
  updateTray();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.dock?.hide();

  const iconBuf = fs.readFileSync(path.join(__dirname, 'tray-icon.png'));
  const icon = nativeImage.createFromBuffer(iconBuf, { scaleFactor: 2.0 });
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.on('click', () => tray.popUpContextMenu());
  updateTray();
  setupAutoUpdater();

  ipcMain.on('check-code', (_, entered) => {
    if (entered === currentCode) {
      closeAll();
      startCycle(cooldownMs());
    } else {
      if (inputWin && !inputWin.isDestroyed()) inputWin.webContents.send('wrong-code');
    }
  });

  ipcMain.on('pause-session', () => pauseSession());
  ipcMain.on('time-up',       () => showFail());
  ipcMain.on('new-code',      () => { closeAll(); startCycle(cooldownMs()); });
  ipcMain.on('sleep-now',     () => {
    closeAll();
    try { execSync('pmset sleepnow'); } catch { /* non-mac or permission denied */ }
  });
});

app.on('window-all-closed', e => e.preventDefault());
