'use strict';
/* Slimme to-do-lijst op het overzicht.
   Eigen taken (met of zonder datum) + taken die het dashboard zelf bijhoudt op basis van Betalen,
   de mailkoppeling en de reservekopie. Een automatische taak afvinken verbergt hem tot de situatie verandert. */

const TODO_STORE = 'hoekje-kantoor-todo';
function todoLoad() {
  try { return Object.assign({ taken: [], weg: {} }, JSON.parse(localStorage.getItem(TODO_STORE) || '{}')); }
  catch (e) { return { taken: [], weg: {} }; }
}
let T = todoLoad();
function todoSave() { try { localStorage.setItem(TODO_STORE, JSON.stringify(T)); } catch (e) {} }

// Eenmalig: de openstaande punten uit het gesprek van 25-11-2026 als startlijst.
if (!T.gestart) {
  T.gestart = true;
  const nu = Date.now();
  T.taken.push(
    { id: 't1', tekst: 'Account aanmaken in de Grootboek Sorteerder en inloggen in Outlook én in het dashboard', klaar: false, gemaakt: nu },
    { id: 't2', tekst: 'Webadres van de kassa (MplusKASSA) invullen bij Instellingen', klaar: false, gemaakt: nu },
    { id: 't3', tekst: 'Stream-adres voor focus-muziek invullen bij Instellingen', klaar: false, gemaakt: nu },
    { id: 't4', tekst: 'Controleren of "Zoek facturen in mijn mail" nog werkt (Azure 30 dagen)', datum: '2026-12-26', klaar: false, gemaakt: nu },
  );
  todoSave();
}

const vandaagIso = () => iso(vandaag());
const kortDatum = (s) => isoToDate(s).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });

/* ---------- Automatische taken ---------- */
function autoTaken() {
  const uit = [];
  const nu = vandaagIso();
  if (typeof B !== 'undefined') {
    // Facturen die klaarstaan om te betalen
    const teBetalen = B.rijen.filter((r) => !r.incasso && !r.alBetaald);
    if (teBetalen.length) {
      const eerste = teBetalen.map((r) => r.datum).filter(Boolean).sort()[0];
      const laat = teBetalen.some((r) => r.telaat || (r.datum && r.datum <= nu));
      uit.push({
        key: 'betalen', sig: teBetalen.length + '|' + eerste,
        tekst: teBetalen.length === 1 ? '1 factuur betalen' : teBetalen.length + ' facturen betalen',
        meta: eerste ? (laat ? 'eerste moet vandaag of is te laat' : 'eerste uiterlijk ' + kortDatum(eerste)) : '',
        laat, actie: () => openView('betalen'),
      });
    }
    // Betaalbestand gemaakt maar misschien nog niet getekend
    if (B.laatste) {
      uit.push({ key: 'tekenen', sig: B.laatste.naam, tekst: 'Betaalbestand importeren en tekenen in Rabobank', meta: B.laatste.naam, actie: () => openView('betalen') });
    }
    if (B.mailFout) {
      uit.push({ key: 'mailfout', sig: B.mailFout, tekst: 'Zoeken in de mail werkt niet: opnieuw koppelen met Microsoft', meta: B.mailFout, laat: true, actie: () => { renderSettings(); show('instellingen'); } });
    }
  }
  if (S.kopieStatus && /mislukt/i.test(S.kopieStatus)) {
    uit.push({ key: 'kopie', sig: S.kopieStatus, tekst: 'Reservekopie in Dropbox lukt niet', meta: S.kopieStatus.replace(/^Reservekopie mislukt:\s*/, ''), laat: true, actie: () => { renderSettings(); show('instellingen'); } });
  }
  return uit.filter((a) => T.weg[a.key] !== a.sig);
}
function openView(id) { if (typeof open === 'function') open(id); }

/* ---------- Tekenen ---------- */
function renderTodo() {
  const ul = $('#todoLijst');
  if (!ul) return;
  const nu = vandaagIso();
  ul.innerHTML = '';
  const auto = autoTaken();
  const eigen = T.taken.filter((t) => !t.klaar).sort((a, b) => (a.datum || '9999').localeCompare(b.datum || '9999') || a.gemaakt - b.gemaakt);
  const klaar = T.taken.filter((t) => t.klaar).sort((a, b) => b.klaarOp - a.klaarOp);

  const regel = (opts) => {
    const cb = el('input', { type: 'checkbox', 'aria-label': (opts.klaar ? 'Niet afgerond: ' : 'Afvinken: ') + opts.tekst });
    cb.checked = !!opts.klaar;
    cb.onchange = opts.vink;
    const tekst = opts.actie ? el('button', { class: 'link', type: 'button', onclick: opts.actie }, opts.tekst) : el('span', {}, opts.tekst);
    const li = el('li', { class: [opts.auto && 'auto', opts.laat && 'laat', opts.vandaag && 'vandaag', opts.klaar && 'klaar'].filter(Boolean).join(' ') },
      cb, el('span', { class: 't' }, tekst, opts.meta ? el('span', { class: 'meta' }, opts.meta) : null));
    if (opts.weg) li.append(el('button', { class: 'icon', 'aria-label': 'Verwijderen: ' + opts.tekst, title: 'Verwijderen', html: ICON.trash, onclick: opts.weg }));
    return li;
  };

  for (const a of auto) {
    ul.append(regel({ ...a, auto: true, vink: () => { T.weg[a.key] = a.sig; todoSave(); renderTodo(); } }));
  }
  for (const t of eigen) {
    const laat = t.datum && t.datum < nu;
    const vandaagT = t.datum === nu;
    ul.append(regel({
      tekst: t.tekst, laat, vandaag: vandaagT,
      meta: t.datum ? (vandaagT ? 'vandaag' : (laat ? 'was ' : '') + kortDatum(t.datum)) : '',
      vink: () => { t.klaar = true; t.klaarOp = Date.now(); todoSave(); renderTodo(); },
      weg: () => { T.taken = T.taken.filter((x) => x !== t); todoSave(); renderTodo(); },
    }));
  }
  if (!auto.length && !eigen.length) ul.append(el('li', { class: 'kop' }, 'Alles gedaan 🎉'));
  // Afgeronde taken: een week zichtbaar, daarna opgeruimd.
  const grens = Date.now() - 7 * 864e5;
  T.taken = T.taken.filter((t) => !t.klaar || t.klaarOp > grens);
  if (klaar.length) {
    ul.append(el('li', { class: 'kop' }, 'Afgerond'));
    for (const t of klaar.slice(0, 5)) {
      ul.append(regel({
        tekst: t.tekst, klaar: true,
        meta: 'afgevinkt ' + new Date(t.klaarOp).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }),
        vink: () => { t.klaar = false; delete t.klaarOp; todoSave(); renderTodo(); },
      }));
    }
  }
  const aantal = auto.length + eigen.length;
  const laatAantal = auto.filter((a) => a.laat).length + eigen.filter((t) => t.datum && t.datum <= nu).length;
  $('#todoTel').textContent = aantal ? aantal + ' open' + (laatAantal ? ' · ' + laatAantal + ' vandaag/te laat' : '') : '';
}

function initTodo() {
  $('#todoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const tekst = $('#todoTekst').value.trim();
    if (!tekst) return;
    T.taken.push({ id: 't' + Date.now().toString(36), tekst, datum: $('#todoDatum').value || '', klaar: false, gemaakt: Date.now() });
    $('#todoTekst').value = '';
    $('#todoDatum').value = '';
    todoSave();
    renderTodo();
  });
  window.addEventListener('hoekje-data', renderTodo);
  renderTodo();
  setInterval(renderTodo, 60 * 1000);
  // Op de achtergrond elk uur in de mail kijken, zodat de lijst ook zonder het Betalen-scherm actueel blijft.
  const achtergrond = () => {
    if (typeof zoekInMail === 'function' && window.hoekje && window.hoekje.mailFacturen && (!B.laatsteMailZoek || Date.now() - B.laatsteMailZoek > 3600e3)) {
      zoekInMail(true).then(renderTodo).catch(() => {});
    }
  };
  setTimeout(achtergrond, 20 * 1000);
  setInterval(achtergrond, 15 * 60 * 1000);
}
initTodo();
