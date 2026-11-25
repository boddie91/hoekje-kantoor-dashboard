const { app, BrowserWindow, session, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REPO = 'boddie91/hoekje-kantoor-dashboard';
const PARTITION = 'persist:hoekje';
app.setAppUserModelId('nl.hoekje.kantoor');
if (!app.requestSingleInstanceLock()) app.quit();

/* ---------- Logboek (voor hulp bij problemen) ---------- */
const DATADIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'HoekjeKantoor');
const LOG = path.join(DATADIR, 'app-log.txt');
try { fs.mkdirSync(DATADIR, { recursive: true }); if (fs.existsSync(LOG) && fs.statSync(LOG).size > 2e6) fs.unlinkSync(LOG); } catch (e) {}
function log(...a) {
  const line = new Date().toISOString() + ' ' + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n';
  try { fs.appendFileSync(LOG, line); } catch (e) {}
}
// Adressen zonder zoekgedeelte loggen (geen inloggegevens of tokens).
const short = (u) => { try { const x = new URL(u); return x.origin + x.pathname; } catch (e) { return String(u).slice(0, 120); } };

/* ---------- Automatisch bijwerken vanaf GitHub ----------
   Vergelijkt de bestanden in de map app/ van de repository met de bestanden
   van deze installatie (via de Git-controlegetallen). Gewijzigde bestanden
   worden eerst volledig gedownload en gecontroleerd, en pas daarna vervangen.
   Ze worden actief na het opnieuw starten van de app. */
const STATE = path.join(DATADIR, 'update.json');
const gitSha = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
let updateBusy = false;
let updateReady = false;

async function checkUpdate() {
  if (updateBusy) return 'bezig';
  updateBusy = true;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/app?ref=main`, {
      headers: { 'User-Agent': 'HoekjeKantoor', Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) { log('update: controle mislukt', res.status); return 'mislukt'; }
    const list = (await res.json()).filter((f) => f.type === 'file' && /^[\w.-]+$/.test(f.name));
    let state = {};
    try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
    const changed = [];
    for (const f of list) {
      const local = path.join(__dirname, f.name);
      const localSha = fs.existsSync(local) ? gitSha(fs.readFileSync(local)) : null;
      if (localSha !== f.sha) changed.push(f);
    }
    if (!changed.length) { log('update: al de nieuwste versie'); return updateReady ? 'klaar' : 'actueel'; }
    const files = [];
    for (const f of changed) {
      const r = await fetch(f.download_url, { headers: { 'User-Agent': 'HoekjeKantoor' } });
      if (!r.ok) throw new Error('download ' + f.name + ' ' + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (gitSha(b) !== f.sha) throw new Error('controle mislukt voor ' + f.name);
      files.push([f, b]);
    }
    for (const [f, b] of files) fs.writeFileSync(path.join(__dirname, f.name + '.nieuw'), b);
    for (const [f] of files) {
      fs.renameSync(path.join(__dirname, f.name + '.nieuw'), path.join(__dirname, f.name));
      state[f.name] = f.sha;
    }
    state.bijgewerkt = new Date().toISOString();
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
    log('update: bijgewerkt', changed.map((f) => f.name));
    updateReady = true;
    if (win && !win.isDestroyed()) win.webContents.send('update-klaar');
    return 'klaar';
  } catch (e) {
    log('update: fout', e.message);
    return 'mislukt';
  } finally {
    updateBusy = false;
  }
}

ipcMain.handle('zoek-update', () => checkUpdate());
ipcMain.handle('versie', () => app.getVersion());
ipcMain.on('herstart', () => { app.relaunch(); app.exit(0); });

/* ---------- User-agent: gewone Chrome, zonder 'Electron' ---------- */
const cleanUA = (ua) => ua.replace(/\s(Electron|hoekje-kantoor|HoekjeKantoor|Hoekje kantoor)\/\S+/gi, '');

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'Hoekje kantoor',
    backgroundColor: '#EEF1F5',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.maximize();
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.once('did-finish-load', () => { if (updateReady) win.webContents.send('update-klaar'); });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  const ua = cleanUA(app.userAgentFallback);
  app.userAgentFallback = ua;
  log('START versie', app.getVersion(), 'electron', process.versions.electron);
  for (const ses of [session.defaultSession, session.fromPartition(PARTITION)]) {
    ses.setUserAgent(ua);
    ses.setPermissionRequestHandler((wc, permission, cb) => {
      const ok = permission !== 'notifications';
      log('toestemming', permission, ok ? 'ja' : 'nee', short(wc.getURL()));
      cb(ok);
    });
    ses.setPermissionCheckHandler((wc, permission) => permission !== 'notifications');
  }
  createWindow();
  setTimeout(checkUpdate, 8000);
  setInterval(checkUpdate, 3 * 60 * 60 * 1000);
});

app.on('web-contents-created', (e, contents) => {
  const type = contents.getType();
  if (type !== 'webview' && type !== 'window') return;
  const tag = type + '#' + contents.id;
  contents.on('did-start-navigation', (ev) => { if (ev.isMainFrame) log(tag, 'navigeert', short(ev.url)); });
  contents.on('did-fail-load', (ev, code, desc, url, isMain) => { if (isMain && code !== -3) log(tag, 'MISLUKT', code, desc, short(url)); });
  contents.on('render-process-gone', (ev, d) => log(tag, 'GECRASHT', d.reason));
  contents.on('console-message', (ev, level, message) => {
    const lvl = ev && ev.level !== undefined ? ev.level : level;
    const msg = ev && ev.message !== undefined ? ev.message : message;
    if (lvl === 'error' || lvl === 3) log(tag, 'console-fout', String(msg).slice(0, 300));
  });
  if (type !== 'webview') return;
  contents.setWindowOpenHandler(({ url }) => {
    log(tag, 'pop-up', short(url));
    if (!/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1100, height: 800, webPreferences: { partition: PARTITION } },
    };
  });
});

app.on('window-all-closed', () => app.quit());
