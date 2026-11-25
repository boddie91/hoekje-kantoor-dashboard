const { app, BrowserWindow, session, shell, ipcMain, net, dialog, nativeImage, safeStorage } = require('electron');
const { pathToFileURL } = require('url');
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
    // net.fetch gebruikt het netwerk van Chromium (zelfde instellingen als de websites in de app).
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/contents/app?ref=main`, {
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
      const r = await net.fetch(f.download_url, { headers: { 'User-Agent': 'HoekjeKantoor' } });
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
    log('update: fout', e.message, e.cause ? String(e.cause.code || e.cause.message || e.cause) : '');
    return 'mislukt';
  } finally {
    updateBusy = false;
  }
}

ipcMain.handle('zoek-update', () => checkUpdate());
ipcMain.handle('versie', () => app.getVersion());
ipcMain.on('herstart', () => { app.relaunch(); app.exit(0); });

/* ---------- Betalen: pdf's lezen en betaalbestanden bewaren ---------- */
let pdfjs = null;
async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  // pdf.js verwacht deze browseronderdelen; voor alleen tekst lezen volstaat een eenvoudige versie.
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = class DOMMatrix { constructor(i) { const a = Array.isArray(i) ? i : [1, 0, 0, 1, 0, 0]; [this.a, this.b, this.c, this.d, this.e, this.f] = a; } };
  if (!globalThis.Path2D) globalThis.Path2D = class Path2D {};
  pdfjs = await import(pathToFileURL(path.join(__dirname, 'pdf.min.mjs')).href);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(__dirname, 'pdf.worker.min.mjs')).href;
  return pdfjs;
}
const isPdf = (p) => typeof p === 'string' && /\.pdf$/i.test(p) && fs.existsSync(p);
const isOwnFile = (p) => typeof p === 'string' && /\.(pdf|xml)$/i.test(p) && fs.existsSync(p);

ipcMain.handle('pdf-tekst', async (e, file) => {
  if (!isPdf(file)) return { fout: 'Geen pdf-bestand' };
  try {
    const lib = await loadPdfjs();
    const data = new Uint8Array(fs.readFileSync(file));
    const doc = await lib.getDocument({ data, isEvalSupported: false, verbosity: 0 }).promise;
    let tekst = '';
    for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      tekst += tc.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join('') + '\n';
    }
    await doc.destroy();
    return { tekst };
  } catch (err) {
    log('pdf: fout', path.basename(file), err.message);
    return { fout: err.message };
  }
});

ipcMain.handle('recente-pdfs', () => {
  const dir = app.getPath('downloads');
  const grens = Date.now() - 30 * 24 * 3600 * 1000;
  try {
    return fs.readdirSync(dir)
      .filter((n) => /\.pdf$/i.test(n))
      .map((n) => { const p = path.join(dir, n); const s = fs.statSync(p); return { naam: n, pad: p, tijd: s.mtimeMs, grootte: s.size }; })
      .filter((x) => x.tijd > grens)
      .sort((a, b) => b.tijd - a.tijd)
      .slice(0, 40);
  } catch (err) { return []; }
});

ipcMain.handle('kies-pdfs', async () => {
  const r = await dialog.showOpenDialog(win, { title: "Facturen kiezen", defaultPath: app.getPath('downloads'), properties: ['openFile', 'multiSelections'], filters: [{ name: "Pdf's", extensions: ['pdf'] }] });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('bewaar-betaalbestand', (e, xml, naam) => {
  const veilig = String(naam).replace(/[^\w.-]/g, '_');
  if (!/\.xml$/.test(veilig) || typeof xml !== 'string') return { fout: 'Ongeldig bestand' };
  const p = path.join(app.getPath('downloads'), veilig);
  fs.writeFileSync(p, xml, 'utf8');
  log('betaalbestand bewaard', veilig);
  return { pad: p };
});

ipcMain.handle('pdf-base64', (e, p) => {
  if (!isPdf(p) || path.dirname(p) !== app.getPath('downloads')) return null;
  return fs.readFileSync(p).toString('base64');
});
ipcMain.on('toon-bestand', (e, p) => { if (isOwnFile(p)) shell.showItemInFolder(p); });
ipcMain.on('open-bestand', (e, p) => { if (isPdf(p)) shell.openPath(p); });
ipcMain.on('sleep-bestand', (e, p) => {
  if (!isOwnFile(p)) return;
  e.sender.startDrag({ file: p, icon: nativeImage.createFromPath(path.join(__dirname, 'icon.ico')).resize({ width: 32, height: 32 }) });
});

/* ---------- Microsoft-koppeling: facturen uit de mailbox (Microsoft Graph) ----------
   Inloggen met PKCE (geen geheim nodig). Alleen leesrechten op mail (Mail.Read).
   De vernieuwingssleutel wordt versleuteld met Windows (safeStorage) bewaard. */
const MS_FILE = path.join(DATADIR, 'microsoft.bin');
const MS_REDIRECT = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
const MS_SCOPE = 'offline_access User.Read Mail.Read';
const MS_AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
let ms = { clientId: '', refresh: '', access: '', verloopt: 0, email: '' };
function msLaad() {
  try {
    const buf = fs.readFileSync(MS_FILE);
    const j = JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8'));
    ms = Object.assign(ms, j, { access: '', verloopt: 0 });
  } catch (e) {}
}
function msBewaar() {
  const j = JSON.stringify({ clientId: ms.clientId, refresh: ms.refresh, email: ms.email });
  try { fs.writeFileSync(MS_FILE, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(j) : Buffer.from(j)); } catch (e) { log('microsoft: bewaren mislukt', e.message); }
}
async function msToken(params) {
  const body = new URLSearchParams(Object.assign({ client_id: ms.clientId, scope: MS_SCOPE }, params));
  const r = await net.fetch(MS_AUTH + '/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description ? String(j.error_description).split('\r')[0] : 'Inloggen bij Microsoft mislukt (' + r.status + ')');
  ms.access = j.access_token;
  ms.verloopt = Date.now() + (j.expires_in || 3600) * 1000 - 60000;
  if (j.refresh_token) ms.refresh = j.refresh_token;
  msBewaar();
}
async function msAccess() {
  if (ms.access && Date.now() < ms.verloopt) return ms.access;
  if (!ms.refresh) throw new Error('Niet gekoppeld met Microsoft.');
  await msToken({ grant_type: 'refresh_token', refresh_token: ms.refresh });
  return ms.access;
}
async function graph(pad, opts = {}) {
  const url = pad.startsWith('https://') ? pad : 'https://graph.microsoft.com/v1.0' + pad;
  const r = await net.fetch(url, { headers: { Authorization: 'Bearer ' + (await msAccess()) } });
  if (!r.ok) throw new Error('Microsoft gaf een fout (' + r.status + ')');
  return opts.bytes ? Buffer.from(await r.arrayBuffer()) : r.json();
}
function msInloggen(clientId) {
  return new Promise((resolve) => {
    ms.clientId = String(clientId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(ms.clientId)) return resolve({ fout: 'De toepassings-id klopt niet. Het is een code van 36 tekens met streepjes.' });
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const state = crypto.randomBytes(12).toString('hex');
    const url = MS_AUTH + '/authorize?' + new URLSearchParams({
      client_id: ms.clientId, response_type: 'code', redirect_uri: MS_REDIRECT, response_mode: 'query',
      scope: MS_SCOPE, code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'select_account',
    });
    const w = new BrowserWindow({ width: 520, height: 720, parent: win, modal: true, title: 'Koppelen met Microsoft', autoHideMenuBar: true, webPreferences: { partition: PARTITION } });
    let klaar = false;
    const check = async (e, u) => {
      u = (e && e.url) || u || '';
      if (klaar || !String(u).startsWith(MS_REDIRECT)) return;
      klaar = true;
      if (e && e.preventDefault) e.preventDefault();
      const q = new URL(u).searchParams;
      w.close();
      if (q.get('error')) return resolve({ fout: q.get('error_description') || 'Koppelen geannuleerd.' });
      if (q.get('state') !== state) return resolve({ fout: 'Koppelen mislukt (controle).' });
      try {
        await msToken({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: MS_REDIRECT, code_verifier: verifier });
        const me = await graph('/me?$select=mail,userPrincipalName');
        ms.email = me.mail || me.userPrincipalName || '';
        msBewaar();
        log('microsoft: gekoppeld');
        resolve({ email: ms.email });
      } catch (err) { resolve({ fout: err.message }); }
    };
    w.webContents.on('will-redirect', check);
    w.webContents.on('will-navigate', check);
    w.webContents.on('did-redirect-navigation', (e, u) => check(e, u));
    w.webContents.on('did-navigate', (e, u) => check(null, u));
    w.on('closed', () => { if (!klaar) resolve({ fout: 'Koppelen geannuleerd.' }); });
    w.loadURL(url);
  });
}
ipcMain.handle('ms-status', () => { msLaad(); return { gekoppeld: !!ms.refresh, email: ms.email, clientId: ms.clientId }; });
ipcMain.handle('ms-koppel', (e, clientId) => msInloggen(clientId));
ipcMain.handle('ms-ontkoppel', () => { ms = { clientId: ms.clientId, refresh: '', access: '', verloopt: 0, email: '' }; msBewaar(); return true; });

const MAILPDF = path.join(DATADIR, 'mail-pdf');
ipcMain.handle('mail-facturen', async (e, dagen) => {
  try {
    msLaad();
    fs.mkdirSync(MAILPDF, { recursive: true });
    const sinds = new Date(Date.now() - Math.max(1, Math.min(120, +dagen || 30)) * 864e5).toISOString();
    let url = '/me/messages?' + new URLSearchParams({
      $filter: `receivedDateTime ge ${sinds} and hasAttachments eq true`,
      $orderby: 'receivedDateTime desc', $select: 'id,subject,from,receivedDateTime', $top: '50',
    });
    const mails = [];
    for (let p = 0; url && p < 6; p++) { const j = await graph(url); mails.push(...(j.value || [])); url = j['@odata.nextLink']; }
    const uit = [];
    for (const m of mails) {
      const atts = await graph(`/me/messages/${m.id}/attachments?$select=id,name,contentType,size`);
      for (const a of atts.value || []) {
        if (a['@odata.type'] !== '#microsoft.graph.fileAttachment' || !(/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.name || ''))) continue;
        const sleutel = crypto.createHash('sha1').update(m.id + '|' + a.id).digest('hex').slice(0, 16);
        const naam = (a.name || 'factuur.pdf').replace(/[\\/:*?"<>|]/g, '_');
        const pad = path.join(MAILPDF, sleutel + '-' + naam);
        if (!fs.existsSync(pad)) fs.writeFileSync(pad, await graph(`/me/messages/${m.id}/attachments/${a.id}/$value`, { bytes: true }));
        uit.push({ pad, naam, sleutel, van: (m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address)) || '', vanAdres: (m.from && m.from.emailAddress && m.from.emailAddress.address) || '', onderwerp: m.subject || '', datum: m.receivedDateTime });
      }
    }
    log('microsoft: mails bekeken', mails.length, 'pdf-bijlagen', uit.length);
    return { bijlagen: uit, mails: mails.length };
  } catch (err) {
    log('microsoft: fout', err.message);
    return { fout: err.message };
  }
});

/* ---------- Reservekopie van de boekingsregels in Dropbox ---------- */
function dropboxMap() {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA || '', 'Dropbox', 'info.json'), 'utf8'));
    const p = (info.personal && info.personal.path) || (info.business && info.business.path);
    if (p && fs.existsSync(p)) return p;
  } catch (e) {}
  const p = path.join(app.getPath('home'), 'Dropbox');
  return fs.existsSync(p) ? p : null;
}
const KOPIE_MAP = () => { const d = dropboxMap(); return d ? path.join(d, 'Hoekje kantoor', 'Grootboek boekingsregels') : null; };
ipcMain.handle('reservekopie', (e, json) => {
  const dir = KOPIE_MAP();
  if (!dir) return { fout: 'Geen Dropbox-map gevonden op deze computer.' };
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data) || !data.length) return { fout: 'Geen regels om te bewaren.' };
    fs.mkdirSync(dir, { recursive: true });
    const tekst = JSON.stringify(data, null, 2);
    fs.writeFileSync(path.join(dir, 'boekingsregels-laatste.json'), tekst, 'utf8');
    const d = new Date();
    const dag = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    fs.writeFileSync(path.join(dir, `boekingsregels-${dag}.json`), tekst, 'utf8');
    // Dagkopieën van de laatste 90 dagen bewaren.
    const oud = fs.readdirSync(dir).filter((n) => /^boekingsregels-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    while (oud.length > 90) fs.unlinkSync(path.join(dir, oud.shift()));
    return { pad: dir, tijd: d.toISOString() };
  } catch (err) {
    log('reservekopie: fout', err.message);
    return { fout: err.message };
  }
});
ipcMain.on('toon-reservekopie', () => { const dir = KOPIE_MAP(); if (dir && fs.existsSync(dir)) shell.openPath(dir); });

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
  // Downloads uit de websites: zonder opslaan-venster naar Downloads. Een pdf uit Outlook gaat ook naar de Grootboek Sorteerder.
  session.fromPartition(PARTITION).on('will-download', (ev, item, wc) => {
    const dir = app.getPath('downloads');
    const naam = item.getFilename().replace(/[\\/:*?"<>|]/g, '_') || 'download';
    const ext = path.extname(naam);
    let p = path.join(dir, naam);
    for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${path.basename(naam, ext)} (${i})${ext}`);
    item.setSavePath(p);
    let bron = '';
    try { bron = wc ? wc.getURL() : ''; } catch (e) {}
    item.once('done', (e, state) => {
      log('download', state, path.basename(p), short(bron));
      if (state === 'completed' && /\.pdf$/i.test(p) && /outlook\.(live|office|office365)\.com/i.test(bron) && win && !win.isDestroyed()) {
        win.webContents.send('pdf-gedownload', { pad: p, naam: path.basename(p) });
      }
    });
  });
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
  contents.on('console-message', (ev) => {
    if (ev.level === 'error') log(tag, 'console-fout', String(ev.message).slice(0, 300));
  });
  contents.on('certificate-error', (ev, url, error) => log(tag, 'CERTIFICAAT', error, short(url)));
  if (type !== 'webview') return;
  contents.setWindowOpenHandler(({ url }) => {
    log(tag, 'pop-up', short(url));
    // Webpagina's, pdf's (blob:/data:) en lege vensters openen in de app zelf, met de ingebouwde pdf-viewer.
    // Alleen andere soorten links (mailto:, tel:, …) gaan naar Windows.
    if (!/^(https?:|blob:|data:|about:blank)/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1100, height: 800, icon: path.join(__dirname, 'icon.ico'), webPreferences: { partition: PARTITION, plugins: true } },
    };
  });
});

app.on('window-all-closed', () => app.quit());
