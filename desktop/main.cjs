// Bhojpe KDS desktop shell (2026-10-16). Same idea as the bhojpe-poss exe:
// the kitchen screen is the bundled React build; all data comes from the
// KDS server (FastAPI) whose URL is set once on the setup screen and kept in
// userData/config.json. Ctrl+Shift+K reopens setup, F11 toggles fullscreen.
const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB_ROOT = path.join(__dirname, 'app');
// Fixed port keeps the page origin stable, so localStorage (device pairing)
// survives restarts.
const WEB_PORT = 47810;
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
// Live KDS server — used until someone picks another one on the setup screen.
const DEFAULT_BACKEND = 'https://kds.bhojpe.com';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.map': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

let win = null;
let webOrigin = null;

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { return {}; }
}
function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// Static server for the React build with SPA fallback (BrowserRouter routes
// like /station/grill must resolve to index.html).
function startWebServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = path.normalize(path.join(WEB_ROOT, urlPath));
      if (!file.startsWith(WEB_ROOT)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB_ROOT, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server.address().port));
  });
}

function backendUrl() {
  return readConfig().backendUrl || DEFAULT_BACKEND;
}
function showSetup(reason) {
  win.loadFile(path.join(__dirname, 'setup.html'), reason ? { query: { reason } } : undefined);
}
async function reachable(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url + '/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch (e) {
    return false;
  }
}
// Server down/unreachable at launch → setup screen (prefilled) instead of a
// blank kitchen board.
async function showKds() {
  if (await reachable(backendUrl())) win.loadURL(webOrigin + '/');
  else showSetup('unreachable');
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 1024, minHeight: 640,
    title: 'Bhojpe KDS',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.maximize();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  showKds();
}

ipcMain.on('kds:get-config', (e) => { e.returnValue = { ...readConfig(), backendUrl: backendUrl() }; });
ipcMain.handle('kds:save-backend', (e, url) => {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  writeConfig({ ...readConfig(), backendUrl: clean });
  showKds();
  return true;
});
ipcMain.on('kds:open-setup', () => showSetup());

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    let port;
    try { port = await startWebServer(WEB_PORT); } catch (e) { port = await startWebServer(0); }
    webOrigin = 'http://127.0.0.1:' + port;
    createWindow();

    globalShortcut.register('F11', () => { if (win && win.isFocused()) win.setFullScreen(!win.isFullScreen()); });
    globalShortcut.register('CommandOrControl+Shift+K', () => { if (win && win.isFocused()) showSetup(); });
    globalShortcut.register('CommandOrControl+R', () => { if (win && win.isFocused()) win.reload(); });
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
