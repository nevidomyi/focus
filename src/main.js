const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

// ─── Tray icon ────────────────────────────────────────────────────────────────
// Generates a 22×22 RGBA PNG with a white filled circle — no asset file needed.

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcBuf]);
}

function makeTrayIcon() {
  const W = 22, H = 22, cx = 11, cy = 11;
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(1 + W * 4);
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      // Outer ring  8.5–10.5  +  inner dot  <3.5  → target / bullseye ◎
      const onRing = d >= 8.5 && d <= 10.5;
      const onDot  = d <= 3.5;
      // 1-px soft edge
      const ringA = onRing ? 255 : (d > 7.5 && d < 8.5 ? Math.round((d - 7.5) * 255) : d > 10.5 && d < 11.5 ? Math.round((11.5 - d) * 255) : 0);
      const dotA  = onDot  ? 255 : (d > 3.5 && d < 4.5 ? Math.round((4.5 - d) * 255) : 0);
      const alpha = Math.min(255, Math.max(ringA, dotA));
      row[1 + x * 4] = 255; row[2 + x * 4] = 255; row[3 + x * 4] = 255;
      row[4 + x * 4] = alpha;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

function randomMs() {
  if (devFastMode) return 20 * 1000; // 20 sec in fast mode
  return Math.floor((Math.random() * 10 + 5) * 60 * 1000); // 5–15 min
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

function startCycle(initialDelayMs) {
  clearTimers();
  currentCode = generateCode();
  const delay = initialDelayMs !== undefined ? initialDelayMs : randomMs();
  codeShowTimer = setTimeout(showCode, delay);
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
  startCycle(0); // show code immediately on session start
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

  const iconBuf = require('fs').readFileSync(path.join(__dirname, 'tray-icon.png'));
  const icon = nativeImage.createFromBuffer(iconBuf, { scaleFactor: 2.0 });
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.on('click', () => tray.popUpContextMenu());
  updateTray();

  // IPC
  ipcMain.on('check-code', (_, entered) => {
    if (entered === currentCode) {
      closeAll();
      startCycle(cooldownMs()); // 5 min cooldown on success
    } else {
      if (inputWin && !inputWin.isDestroyed()) inputWin.webContents.send('wrong-code');
    }
  });

  ipcMain.on('time-up', () => showFail());

  ipcMain.on('new-code', () => {
    closeAll();
    startCycle(cooldownMs());
  });

  ipcMain.on('sleep-now', () => {
    closeAll();
    try { execSync('pmset sleepnow'); } catch { /* non-mac or permission denied */ }
  });
});

app.on('window-all-closed', e => e.preventDefault());
