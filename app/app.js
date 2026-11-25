'use strict';
const PARTITION = 'persist:hoekje';
const STORE = 'hoekje-kantoor-instellingen';

const DEFAULTS = {
  tabs: [
    { id: 'rabobank', name: 'Rabobank', url: 'https://www.rabobank.nl/bedrijven' },
    { id: 'kpn', name: 'Mijn KPN', url: 'https://www.kpn.com' },
    { id: 'exact', name: 'Exact Online', url: 'https://start.exactonline.nl' },
    { id: 'dropbox', name: 'Dropbox', url: 'https://www.dropbox.com/home' },
    { id: 'kassa', name: 'Kassa', url: '' },
  ],
  exactLeft: 'https://start.exactonline.nl',
  exactRight: 'https://start.exactonline.nl',
  exactSplit: true,
  outlook: 'https://outlook.live.com/mail/',
  grootboek: 'https://boddie91.github.io/grootboek-sorteerder/',
  browserHome: 'https://www.google.nl',
  radio2: 'https://icecast.omroep.nl/radio2-bb-mp3',
  focus: '',
  musicSource: 'radio2',
  volume: 40,
  cols: [3, 2, 1.3],
  gbAuto: true,
  betaalNaam: '',
  betaalIban: '',
  betaalBic: 'RABONL2U',
  betaalModus: 'voor',
  betaalDagen: 2,
  betaalTermijn: 14,
  exactRatio: 0.5,
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s && typeof s === 'object') return Object.assign(structuredClone(DEFAULTS), s);
  } catch (e) { /* standaard gebruiken */ }
  return structuredClone(DEFAULTS);
}
let S = load();
function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }

const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v; // alleen voor vaste pictogrammen
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids) if (k != null) n.append(k);
  return n;
}

const ICON = {
  overzicht: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  browser: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  outlook: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  grootboek: '<svg viewBox="0 0 24 24"><path d="M4 6h10"/><path d="M4 12h7"/><path d="M4 18h4"/><path d="M17 5v14"/><path d="M13.5 15.5L17 19l3.5-3.5"/></svg>',
  euro: '<svg viewBox="0 0 24 24"><path d="M18 6.5A7 7 0 1 0 18 17.5"/><path d="M4 10h9"/><path d="M4 14h9"/></svg>',
  instellingen: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/></svg>',
  reload: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
};

function normUrl(v) {
  v = (v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (!/\s/.test(v) && /\.[a-z]{2,}/i.test(v)) return 'https://' + v;
  return 'https://www.google.nl/search?q=' + encodeURIComponent(v);
}

/* ---------- Webviews ---------- */
// Maakt een browservak met eigen knoppen. opts: {address: bool, label: string}
function makeWeb(container, url, opts = {}) {
  container.innerHTML = '';
  if (!url) {
    container.append(el('div', { class: 'empty' },
      el('strong', {}, 'Nog geen webadres ingesteld'),
      el('span', {}, 'Vul het adres in bij Instellingen (tandwiel onderaan de zijbalk).')));
    return null;
  }
  const wv = el('webview', { src: url, partition: PARTITION, allowpopups: true });
  const back = el('button', { class: 'icon', 'aria-label': 'Vorige pagina', title: 'Vorige', html: ICON.back, onclick: () => wv.canGoBack() && wv.goBack() });
  const fwd = el('button', { class: 'icon', 'aria-label': 'Volgende pagina', title: 'Volgende', html: ICON.fwd, onclick: () => wv.canGoForward() && wv.goForward() });
  const home = el('button', { class: 'icon', 'aria-label': 'Startpagina', title: 'Startpagina', html: ICON.home, onclick: () => wv.loadURL(container.dataset.home || url) });
  const reload = el('button', { class: 'icon', 'aria-label': 'Vernieuwen', title: 'Vernieuwen', html: ICON.reload, onclick: () => wv.reload() });
  const bar = el('div', { class: 'wv-bar' }, back, fwd, home, reload);
  if (opts.address) {
    const id = 'a' + Math.random().toString(36).slice(2);
    const addr = el('input', { class: 'addr', id, type: 'text', value: url, 'aria-label': 'Webadres', spellcheck: 'false',
      onkeydown: (e) => { if (e.key === 'Enter') { const u = normUrl(addr.value); if (u) wv.loadURL(u); } } });
    wv.addEventListener('did-navigate', (e) => { addr.value = e.url; });
    wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) addr.value = e.url; });
    bar.append(addr);
  } else if (opts.label) {
    bar.append(el('span', { class: 'label' }, opts.label));
  }
  wv.addEventListener('dom-ready', () => { wv.dataset.ready = '1'; });
  container.dataset.home = url;
  container.append(bar, wv);
  return wv;
}

/* ---------- Weergaven en zijbalk ---------- */
const main = $('.main');
const fullViews = {}; // id -> {section, url}

function fullView(id, title, url, opts = {}) {
  let v = fullViews[id];
  if (!v) {
    const section = el('section', { class: 'view full', id: 'view-' + id, 'aria-label': title });
    const pane = el('div', { class: 'pane' });
    section.append(pane);
    main.append(section);
    v = fullViews[id] = { section, pane, url: null, title };
  }
  v.title = title;
  if (v.url !== url) { v.url = url; makeWeb(v.pane, url, opts); }
  return v;
}

let current = 'overzicht';
// Exact, Outlook en de Grootboek Sorteerder staan op het overzicht. "Groot openen" vergroot dat
// vak op het overzicht zelf, zodat er geen tweede kopie van de website hoeft te laden.
const FOCUS = { exact: 'Exact Online', outlook: 'Outlook', grootboek: 'Grootboek Sorteerder' };
function setFocus(f) {
  $('.grid').dataset.focus = f || '';
  $('#exactFull').setAttribute('aria-label', f === 'exact' ? 'Terug naar het overzicht' : 'Exact Online groot openen');
  $('#gbFull').setAttribute('aria-label', f === 'grootboek' ? 'Terug naar het overzicht' : 'Grootboek Sorteerder groot openen');
  if (f === 'grootboek') ensureLoaded('gb');
  if (f === 'outlook') ensureLoaded('outlook');
}
function show(id) {
  current = id;
  const viewId = id in FOCUS ? 'overzicht' : id;
  if (viewId === 'overzicht') setFocus(id in FOCUS ? id : '');
  document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + viewId));
  document.querySelectorAll('#sidebar .nav').forEach((b) => {
    if (b.dataset.view === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const t = { overzicht: 'Overzicht', instellingen: 'Instellingen', betalen: 'Betalen' }[id] || FOCUS[id] || (fullViews[id] && fullViews[id].title) || '';
  $('#title').textContent = t;
  if (id === 'betalen' && typeof betalenGetoond === 'function') betalenGetoond();
}

function open(id) {
  if (id === 'tab-exact') id = 'exact';
  if (id === 'browser') fullView('browser', 'Browser', S.browserHome, { address: true });
  else if (id.startsWith('tab-')) {
    const t = S.tabs.find((x) => 'tab-' + x.id === id);
    if (!t) return show('overzicht');
    fullView(id, t.name, t.url, { address: true });
  }
  show(id);
}

function initial(name) {
  const w = (name || '?').replace(/^mijn\s+/i, '').trim();
  return (w[0] || '?').toUpperCase();
}

function renderSidebar() {
  const nav = $('#sidebar');
  nav.innerHTML = '';
  const item = (id, label, icon) => el('button', { class: 'nav', 'data-view': id, 'aria-label': label, title: label, html: icon, onclick: () => open(id) });
  nav.append(
    item('overzicht', 'Overzicht', ICON.overzicht),
    item('browser', 'Browser', ICON.browser),
    item('outlook', 'Outlook', ICON.outlook),
    item('grootboek', 'Grootboek Sorteerder', ICON.grootboek),
    item('betalen', 'Betalen', ICON.euro),
    el('div', { class: 'sep', 'aria-hidden': 'true' }),
  );
  for (const t of S.tabs) {
    nav.append(el('button', { class: 'nav web', 'data-view': 'tab-' + t.id, 'aria-label': t.name, title: t.name, onclick: () => open('tab-' + t.id) }, initial(t.name)));
  }
  const set = item('instellingen', 'Instellingen', ICON.instellingen);
  set.classList.add('bottom');
  set.onclick = () => { renderSettings(); show('instellingen'); };
  nav.append(set);
  show(current);
}

/* ---------- Overzicht ---------- */
function setSplit(on) {
  $('#exactSplit').classList.toggle('single', !on);
  $('#splitBtn').setAttribute('aria-pressed', String(on));
}
// Websites op het overzicht laden na elkaar in plaats van allemaal tegelijk.
const loaders = {
  exactLeft: () => makeWeb($('#exactLeft'), S.exactLeft, { label: 'Links' }),
  exactRight: () => makeWeb($('#exactRight'), S.exactRight, { label: 'Rechts' }),
  outlook: () => makeWeb($('#outlookMini'), S.outlook),
  gb: () => makeWeb($('#gbMini'), S.grootboek),
};
const loaded = {};
function ensureLoaded(k) { if (!loaded[k]) { loaded[k] = true; loaders[k](); } }
function reload(k) { loaded[k] = true; loaders[k](); }
function initOverview() {
  setSplit(S.exactSplit);
  ensureLoaded('exactLeft');
  setTimeout(() => ensureLoaded('outlook'), 2500);
  setTimeout(() => ensureLoaded('gb'), 6000);
  if (S.exactSplit) setTimeout(() => ensureLoaded('exactRight'), 9000);
  $('#splitBtn').onclick = () => {
    const on = $('#splitBtn').getAttribute('aria-pressed') !== 'true';
    setSplit(on);
    if (on) ensureLoaded('exactRight');
  };
  $('#exactFull').onclick = () => (current === 'exact' ? open('overzicht') : open('exact'));
  $('#gbFull').onclick = () => (current === 'grootboek' ? open('overzicht') : open('grootboek'));
}

/* ---------- Breedte van de tegels ---------- */
const MINW = [260, 240, 260];
function applyLayout() {
  const c = S.cols;
  $('.grid').style.gridTemplateColumns = `${c[0]}fr 10px ${c[1]}fr 10px ${c[2]}fr`;
  const r = S.exactRatio;
  $('#exactLeft').style.flex = `${r} 1 0`;
  $('#exactRight').style.flex = `${1 - r} 1 0`;
}
function dragHandle(handle, onStart, onMove, onReset) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const start = onStart(e);
    document.body.classList.add('dragging');
    handle.classList.add('active');
    const move = (ev) => onMove(ev, start);
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging');
      handle.classList.remove('active');
      save();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
  handle.addEventListener('dblclick', () => { onReset(); applyLayout(); save(); });
  handle.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowLeft' ? -24 : e.key === 'ArrowRight' ? 24 : 0;
    if (!d) return;
    e.preventDefault();
    const s = onStart({ clientX: 0 });
    onMove({ clientX: d, viaKey: true }, s);
    save();
  });
}
function initResize() {
  const grid = $('.grid');
  const cells = () => [grid.children[0], grid.children[2], grid.children[4]].map((x) => x.getBoundingClientRect().width);
  document.querySelectorAll('.grid > .gutter').forEach((g) => {
    const i = +g.dataset.gutter;
    dragHandle(g,
      (e) => ({ x: e.clientX, w: cells() }),
      (ev, s) => {
        const w = s.w.slice();
        const total = w[i] + w[i + 1];
        let left = Math.max(MINW[i], Math.min(total - MINW[i + 1], w[i] + (ev.clientX - s.x)));
        w[i] = left; w[i + 1] = total - left;
        S.cols = w.map((x) => Math.round(x));
        applyLayout();
      },
      () => { S.cols = DEFAULTS.cols.slice(); });
  });
  const sg = $('#splitGutter');
  dragHandle(sg,
    (e) => ({ x: e.clientX, rect: $('#exactSplit').getBoundingClientRect(), r: S.exactRatio }),
    (ev, s) => {
      const r = ev.viaKey ? s.r + ev.clientX / s.rect.width : (ev.clientX - s.rect.left) / s.rect.width;
      S.exactRatio = Math.max(0.15, Math.min(0.85, r));
      applyLayout();
    },
    () => { S.exactRatio = 0.5; });
}

/* ---------- Pdf uit Outlook naar de Grootboek Sorteerder ---------- */
let toastTimer;
function toast(tekst, fout) {
  const t = $('#toast');
  t.textContent = tekst;
  t.classList.toggle('fout', !!fout);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 6000);
}
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
async function naarGrootboek(d) {
  if (!S.gbAuto || !window.hoekje || !window.hoekje.pdfBase64) return;
  ensureLoaded('gb');
  const b64 = await window.hoekje.pdfBase64(d.pad);
  if (!b64) return;
  for (let i = 0; i < 30; i++) {
    const wv = $('#gbMini webview');
    if (wv && wv.dataset.ready) {
      try {
        const ok = await wv.executeJavaScript(`typeof window.grootboekLaadPdf === 'function' ? window.grootboekLaadPdf(${JSON.stringify(b64)}, ${JSON.stringify(d.naam)}) : 'nee'`);
        if (ok === true) { toast(d.naam + ' staat in de Grootboek Sorteerder'); return; }
        if (ok === 'nee' && i > 8) break;
      } catch (e) { /* pagina nog niet klaar */ }
    }
    await wacht(500);
  }
  toast(d.naam + ' kon niet in de Grootboek Sorteerder worden geopend. Vernieuw de Grootboek Sorteerder en probeer het opnieuw.', true);
}
if (window.hoekje && window.hoekje.opPdfGedownload) window.hoekje.opPdfGedownload(naarGrootboek);

/* ---------- Rekenmachine ---------- */
const calc = { cur: '0', acc: null, op: null, fresh: true };
const fmt = (n) => {
  if (!isFinite(n)) return 'Fout';
  return n.toLocaleString('nl-NL', { maximumFractionDigits: 10, useGrouping: true });
};
const num = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
function calcShow() { $('#calcOut').textContent = calc.cur; }
function apply(a, b, op) {
  switch (op) { case '+': return a + b; case '−': return a - b; case '×': return a * b; case '÷': return b === 0 ? NaN : a / b; }
  return b;
}
function press(k) {
  if (/^[0-9]$/.test(k)) {
    if (calc.fresh || calc.cur === '0') { calc.cur = k; calc.fresh = false; } else if (calc.cur.replace(/\D/g, '').length < 15) calc.cur += k;
  } else if (k === ',') {
    if (calc.fresh) { calc.cur = '0,'; calc.fresh = false; } else if (!calc.cur.includes(',')) calc.cur += ',';
  } else if (k === 'C') { calc.cur = '0'; calc.acc = null; calc.op = null; calc.fresh = true; }
  else if (k === '±') { if (calc.cur !== '0') calc.cur = calc.cur.startsWith('-') ? calc.cur.slice(1) : '-' + calc.cur; }
  else if (k === '%') { calc.cur = fmt(num(calc.cur) / 100); calc.fresh = true; }
  else if (k === '⌫') { calc.cur = calc.fresh || calc.cur.length <= 1 ? '0' : calc.cur.slice(0, -1); }
  else if ('+−×÷'.includes(k)) {
    const v = num(calc.cur);
    if (calc.op && !calc.fresh) { calc.acc = apply(calc.acc, v, calc.op); calc.cur = fmt(calc.acc); } else if (calc.acc === null || !calc.op) calc.acc = v;
    calc.op = k; calc.fresh = true;
  } else if (k === '=') {
    if (calc.op) { const r = apply(calc.acc, num(calc.cur), calc.op); calc.cur = fmt(r); calc.acc = null; calc.op = null; calc.fresh = true; }
  }
  calcShow();
}
function initCalc() {
  const keys = [['C', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7'], ['8'], ['9'], ['×', 'op'], ['4'], ['5'], ['6'], ['−', 'op'], ['1'], ['2'], ['3'], ['+', 'op'], ['0', 'wide'], [','], ['=', 'eq']];
  const names = { '±': 'Plus of min', '÷': 'Delen', '×': 'Keer', '−': 'Min', '+': 'Plus', '=': 'Is', ',': 'Komma', '%': 'Procent', C: 'Wissen' };
  const box = $('#calcKeys');
  for (const [k, c] of keys) box.append(el('button', { class: 'key ' + (c || ''), 'aria-label': names[k] || k, onclick: () => press(k) }, k));
  const sec = $('.calc');
  sec.tabIndex = 0;
  sec.addEventListener('keydown', (e) => {
    const map = { '+': '+', '-': '−', '*': '×', '/': '÷', Enter: '=', '=': '=', ',': ',', '.': ',', Escape: 'C', Backspace: '⌫', '%': '%' };
    const k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
    if (k) { e.preventDefault(); press(k); }
  });
  calcShow();
}

/* ---------- Muziek ---------- */
const audio = $('#audio');
function setPlayIcon(playing) {
  $('#playIcon').innerHTML = playing ? ICON.pause : ICON.play;
  $('#playBtn').setAttribute('aria-label', playing ? 'Pauzeren' : 'Afspelen');
}
function musicMsg(t) { const m = $('#musicMsg'); m.hidden = !t; m.textContent = t || ''; }
function playSource() {
  const url = S[S.musicSource];
  if (!url) { musicMsg('Nog geen adres ingesteld voor ' + (S.musicSource === 'focus' ? 'focus-muziek' : 'Radio 2') + '. Vul het in bij Instellingen.'); setPlayIcon(false); return; }
  musicMsg('');
  if (audio.src !== url) audio.src = url;
  audio.play().catch(() => { musicMsg('Dit adres speelt niet af. Is het een geluidsstream?'); setPlayIcon(false); });
}
function initMusic() {
  audio.volume = S.volume / 100;
  $('#vol').value = S.volume;
  $('#vol').oninput = (e) => { S.volume = +e.target.value; audio.volume = S.volume / 100; save(); };
  document.querySelectorAll('.music .chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(c.dataset.src === S.musicSource));
    c.onclick = () => {
      S.musicSource = c.dataset.src; save();
      document.querySelectorAll('.music .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      if (!audio.paused) playSource();
    };
  });
  $('#playBtn').onclick = () => { if (audio.paused) playSource(); else audio.pause(); };
  audio.addEventListener('playing', () => setPlayIcon(true));
  audio.addEventListener('pause', () => setPlayIcon(false));
  audio.addEventListener('error', () => { if (audio.src) { musicMsg('Dit adres speelt niet af. Is het een geluidsstream?'); setPlayIcon(false); } });
}

/* ---------- Instellingen ---------- */
function renderSettings() {
  document.querySelectorAll('#view-instellingen [data-key]').forEach((inp) => {
    const k = inp.dataset.key;
    if (inp.type === 'checkbox') inp.checked = !!S[k]; else inp.value = S[k] == null ? '' : S[k];
    inp.onchange = () => {
      if (inp.type === 'checkbox') S[k] = inp.checked;
      else if (inp.type === 'url') S[k] = normUrl(inp.value);
      else if (inp.type === 'number') S[k] = Math.max(0, parseInt(inp.value, 10) || 0);
      else S[k] = inp.value.trim();
      if (inp.type !== 'checkbox') inp.value = S[k];
      save();
      if (k === 'exactLeft') reload('exactLeft');
      if (k === 'exactRight' && loaded.exactRight) reload('exactRight');
      if (k === 'exactSplit') setSplit(S.exactSplit);
      if (k === 'outlook') reload('outlook');
      if (k === 'grootboek') reload('gb');
    };
  });
  const list = $('#tabList');
  list.innerHTML = '';
  S.tabs.forEach((t, i) => {
    const name = el('input', { type: 'text', value: t.name });
    const url = el('input', { type: 'url', value: t.url, placeholder: 'https://…' });
    name.onchange = () => { t.name = name.value.trim() || 'Website'; save(); renderSidebar(); renderSettings(); };
    url.onchange = () => {
      t.url = normUrl(url.value); url.value = t.url; save();
      const v = fullViews['tab-' + t.id];
      if (v) { v.url = null; fullView('tab-' + t.id, t.name, t.url, { address: true }); }
    };
    const move = (d) => { const j = i + d; if (j < 0 || j >= S.tabs.length) return; [S.tabs[i], S.tabs[j]] = [S.tabs[j], S.tabs[i]]; save(); renderSidebar(); renderSettings(); };
    list.append(el('li', { class: 'tabrow' },
      el('span', { class: 'badge', 'aria-hidden': 'true' }, initial(t.name)),
      el('label', { class: 'name' }, 'Naam', name),
      el('label', { class: 'url' }, 'Webadres dat automatisch opent', url),
      el('div', { class: 'row' },
        el('button', { class: 'icon', 'aria-label': t.name + ' omhoog', html: ICON.up, onclick: () => move(-1) }),
        el('button', { class: 'icon', 'aria-label': t.name + ' omlaag', html: ICON.down, onclick: () => move(1) }),
        el('button', { class: 'icon', 'aria-label': t.name + ' verwijderen', html: ICON.trash, onclick: () => {
          if (!confirmInline(t.name)) return;
          S.tabs.splice(i, 1); save();
          const v = fullViews['tab-' + t.id]; if (v) { v.section.remove(); delete fullViews['tab-' + t.id]; }
          renderSidebar(); renderSettings();
        } }))));
  });
}
// Verwijderen vraagt een tweede klik binnen 3 seconden (geen pop-upvensters).
let pendingDelete = null;
function confirmInline(name) {
  if (pendingDelete === name) { pendingDelete = null; return true; }
  pendingDelete = name;
  $('.saved').textContent = 'Klik nog een keer op de prullenbak om ' + name + ' te verwijderen';
  setTimeout(() => { if (pendingDelete === name) pendingDelete = null; $('.saved').textContent = 'Wijzigingen worden meteen bewaard'; }, 3000);
  return false;
}
function initSettings() {
  $('#addTab').onclick = () => {
    S.tabs.push({ id: 't' + Date.now().toString(36), name: 'Nieuwe website', url: '' });
    save(); renderSidebar(); renderSettings();
    const inputs = document.querySelectorAll('#tabList .tabrow:last-child input');
    if (inputs[0]) { inputs[0].focus(); inputs[0].select(); }
  };
  let resetArmed = false;
  $('#resetBtn').onclick = () => {
    if (!resetArmed) { resetArmed = true; $('#resetBtn').textContent = 'Zeker weten? Klik nogmaals'; setTimeout(() => { resetArmed = false; $('#resetBtn').textContent = 'Instellingen terugzetten naar standaard'; }, 3000); return; }
    S = structuredClone(DEFAULTS); save(); location.reload();
  };
  const api = window.hoekje;
  if (api) {
    api.versie().then((v) => { $('#ver').textContent = v; });
    api.opUpdate(() => { $('#updateBar').hidden = false; });
    $('#restartBtn').onclick = () => api.herstart();
    $('#checkBtn').onclick = async () => {
      const msg = $('#checkMsg');
      msg.textContent = 'Bezig met zoeken…';
      const r = await api.zoekUpdate();
      msg.textContent = { actueel: 'Je hebt de nieuwste versie.', klaar: 'Nieuwe versie gedownload. Start opnieuw om hem te gebruiken.', bezig: 'Er wordt al gezocht, probeer het zo nog eens.', mislukt: 'Zoeken lukte niet. Is er internet?' }[r] || '';
    };
  } else {
    $('#checkBtn').disabled = true;
  }
}

/* ---------- Start ---------- */
renderSidebar();
initOverview();
applyLayout();
initResize();
initCalc();
initMusic();
initSettings();
show('overzicht');
