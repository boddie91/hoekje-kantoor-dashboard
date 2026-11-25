'use strict';
/* Betalen: facturen inlezen en een SEPA-betaalbestand (pain.001.001.03) maken voor de Rabobank.
   Het dashboard betaalt zelf nooit iets: het bestand wordt in Rabobank geïmporteerd, gecontroleerd en getekend. */

const BET_STORE = 'hoekje-kantoor-betalen';
const api = window.hoekje;

function betLoad() {
  try { return Object.assign({ rijen: [], bekend: {}, betaald: {}, verwerkt: {} }, JSON.parse(localStorage.getItem(BET_STORE) || '{}')); }
  catch (e) { return { rijen: [], bekend: {}, betaald: {}, verwerkt: {} }; }
}
let B = betLoad();
function betSave() { try { localStorage.setItem(BET_STORE, JSON.stringify(B)); } catch (e) {} }

/* ---------- Hulpjes ---------- */
const euro = (n) => '€ ' + (Number(n) || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseBedrag = (s) => {
  s = String(s).replace(/[€\s]/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const nlDatum = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${+d}-${+m}-${y}`; };
const vandaag = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isoToDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

function ibanSchoon(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function ibanGeldig(iban) {
  iban = ibanSchoon(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const r = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 55);
  let rest = 0;
  for (const ch of r) rest = (rest * 10 + +ch) % 97;
  return rest === 1;
}
const ibanMooi = (s) => ibanSchoon(s).replace(/(.{4})/g, '$1 ').trim();

/* ---------- Werkdagen (weekend en dagen waarop banken niet verwerken) ---------- */
function pasen(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
function isWerkdag(d) {
  const w = d.getDay();
  if (w === 0 || w === 6) return false;
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  if ([101, 501, 1225, 1226].includes(md)) return false;
  const p = pasen(d.getFullYear());
  const t = d.getTime();
  const goedeVrijdag = new Date(p); goedeVrijdag.setDate(p.getDate() - 2);
  const paasmaandag = new Date(p); paasmaandag.setDate(p.getDate() + 1);
  return t !== goedeVrijdag.getTime() && t !== paasmaandag.getTime();
}
function vorigeWerkdag(d) { d = new Date(d); while (!isWerkdag(d)) d.setDate(d.getDate() - 1); return d; }
function volgendeWerkdag(d) { d = new Date(d); while (!isWerkdag(d)) d.setDate(d.getDate() + 1); return d; }
function werkdagenTerug(d, n) { d = vorigeWerkdag(d); for (let i = 0; i < n; i++) { d.setDate(d.getDate() - 1); d = vorigeWerkdag(d); } return d; }

/* ---------- Factuur lezen ---------- */
const MAANDEN = { januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12, jan: 1, feb: 2, mrt: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, okt: 10, nov: 11, dec: 12 };
const DATUM_RE = /(\d{1,2})[-./ ](\d{1,2})[-./ ](\d{2,4})|(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sept?|okt|nov|dec)\.?\s+(\d{4})/i;
function leesDatum(s) {
  const m = DATUM_RE.exec(s);
  if (!m) return null;
  let y, mo, d;
  if (m[1]) { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
  else if (m[4]) { y = +m[4]; mo = +m[5]; d = +m[6]; }
  else { d = +m[7]; mo = MAANDEN[m[8].toLowerCase()]; y = +m[9]; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return iso(new Date(y, mo - 1, d));
}
function naLabel(tekst, labels, lengte = 70) {
  for (const l of labels) {
    const re = new RegExp(l, 'i');
    const m = re.exec(tekst);
    if (m) return tekst.slice(m.index + m[0].length, m.index + m[0].length + lengte);
  }
  return null;
}
const BEDRAG_RE = /-?€?\s?-?\d{1,3}(?:[.\s]\d{3})*,\d{2}(?!\d)|-?€?\s?-?\d+\.\d{2}(?!\d)/g;

function leesFactuur(tekst, eigenIban) {
  const t = tekst.replace(/ /g, ' ');
  const vlak = t.replace(/\s+/g, ' ');
  const r = { iban: '', bedrag: 0, nummer: '', factuurdatum: '', vervaldatum: '', termijn: 0, kenmerk: '', incasso: false, naam: '' };

  // Rekeningnummers: geldige IBAN's, niet de eigen rekening. Voorkeur voor een IBAN dicht bij "IBAN" of "rekening".
  const ibans = [];
  for (const m of vlak.matchAll(/\b([A-Z]{2}\s?\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?)\b/g)) {
    const i = ibanSchoon(m[1]);
    if (ibanGeldig(i) && i !== ibanSchoon(eigenIban) && !ibans.includes(i)) ibans.push(i);
  }
  r.iban = ibans[0] || '';
  r.ibans = ibans;

  // Bedrag: na een totaal-label, anders het hoogste bedrag op de factuur.
  const labels = ['totaal\\s+te\\s+betalen', 'te\\s+betalen\\s+bedrag', 'nog\\s+te\\s+betalen', 'openstaand(?:\\s+bedrag)?', 'factuurbedrag', 'totaalbedrag', 'totaal\\s+incl(?:usief|\\.)?\\s*(?:btw)?', 'te\\s+voldoen', 'te\\s+betalen', 'totaal\\s+eur', 'total\\s+due', 'amount\\s+due', 'totaal'];
  const na = naLabel(vlak, labels, 60);
  const bedragUit = (s) => { const m = (s || '').match(BEDRAG_RE); return m ? Math.abs(parseBedrag(m[0])) : 0; };
  r.bedrag = bedragUit(na);
  if (!r.bedrag) {
    const alle = (vlak.match(BEDRAG_RE) || []).map((x) => Math.abs(parseBedrag(x)));
    r.bedrag = alle.length ? Math.max(...alle) : 0;
  }

  for (const m of vlak.matchAll(/factuur\s*(?:nummer|nr\.?|no\.?)?|invoice\s*(?:no\.?|number|nr\.?)?|factuurnr\.?|nota\s*(?:nummer|nr\.?)/gi)) {
    const c = /^\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-/.]{2,24})/i.exec(vlak.slice(m.index + m[0].length));
    if (c && /\d/.test(c[1]) && !DATUM_RE.test(c[1])) { r.nummer = c[1].replace(/[.\-/]$/, ''); break; }
  }

  r.factuurdatum = leesDatum(naLabel(vlak, ['factuurdatum', 'datum\\s+factuur', 'invoice\\s+date', '\\bdatum\\s*:', '\\bdatum\\b'], 40) || '') || '';
  r.vervaldatum = leesDatum(naLabel(vlak, ['vervaldatum', 'uiterste\\s+betaaldatum', 'betaal(?:datum|termijn)\\s+tot', 'te\\s+betalen\\s+(?:v[oó]{2}r|uiterlijk(?:\\s+op)?)', 'betalen\\s+v[oó]{2}r', 'uiterlijk\\s+(?:op|v[oó]{2}r)?', 'due\\s+date', 'vervalt\\s+op'], 40) || '') || '';
  const term = /(?:binnen|within)\s+(\d{1,3})\s+(?:dagen|days)|(?:betalingstermijn|betaaltermijn|termijn)\s*:?\s*(\d{1,3})\s*dagen/i.exec(vlak);
  if (term) r.termijn = +(term[1] || term[2]);

  const ken = /betalings?kenmerk\s*:?\s*((?:\d[\s]?){7,16}\d)/i.exec(vlak);
  if (ken) r.kenmerk = ken[1].replace(/\s/g, '');

  r.incasso = /automatisch\s+(?:ge[iï]ncasseerd|afgeschreven|ge[iï]nd)|wordt\s+(?:binnenkort\s+)?(?:automatisch\s+)?(?:van\s+uw\s+rekening\s+)?(?:afgeschreven|ge[iï]ncasseerd)|via\s+(?:automatische\s+)?incasso|incassodatum|sepa[-\s]?incasso/i.test(vlak);

  const tnv = /t\.?\s?n\.?\s?v\.?\s*:?\s*([A-Za-z0-9&'.,\- ]{3,60}?)(?=\s{2,}|\s(?:IBAN|BIC|KvK|o\.v\.v|onder|te\s|$))/i.exec(vlak);
  if (tnv) r.naam = tnv[1].trim();
  if (!r.naam) {
    const eerste = t.split('\n').map((x) => x.trim()).find((x) => /[A-Za-z]{3}/.test(x) && x.length < 60 && !/factuur|invoice|pagina|datum/i.test(x));
    r.naam = eerste || '';
  }
  return r;
}

/* ---------- Uitvoerdatum ---------- */
function bepaalDatum(rij) {
  let tot = null, bron = '';
  if (rij.vervaldatum) { tot = isoToDate(rij.vervaldatum); bron = 'Uiterste betaaldatum op de factuur'; }
  else if (rij.factuurdatum && rij.termijn) { tot = isoToDate(rij.factuurdatum); tot.setDate(tot.getDate() + rij.termijn); bron = `Berekend: factuurdatum + ${rij.termijn} dagen`; }
  else if (rij.factuurdatum) { const n = +S.betaalTermijn || 14; tot = isoToDate(rij.factuurdatum); tot.setDate(tot.getDate() + n); bron = `Standaardtermijn: factuurdatum + ${n} dagen`; }
  const nu = vandaag();
  const vroegst = volgendeWerkdag(nu);
  if (!tot) return { datum: iso(vroegst), bron: 'Geen datum op de factuur gevonden – zo snel mogelijk', telaat: false };
  let d;
  if (S.betaalModus === 'direct') { d = vroegst; bron += ' · zo snel mogelijk'; }
  else if (S.betaalModus === 'op') d = vorigeWerkdag(tot);
  else d = werkdagenTerug(tot, +S.betaalDagen || 0);
  if (tot < nu) return { datum: iso(vroegst), bron: 'Uiterste datum ' + nlDatum(iso(tot)) + ' is al voorbij – zo snel mogelijk', telaat: true };
  if (d < vroegst) d = vroegst;
  return { datum: iso(d), bron, telaat: false };
}

/* ---------- Rijen ---------- */
const sleutel = (r) => ibanSchoon(r.iban) + '|' + (r.nummer || '') + '|' + (Number(r.bedrag) || 0).toFixed(2);
function ibanStatus(r) {
  const i = ibanSchoon(r.iban);
  if (!i) return { tekst: 'Geen rekeningnummer gevonden – vul in', cls: 'bad' };
  if (!ibanGeldig(i)) return { tekst: 'Ongeldig rekeningnummer – controleer', cls: 'bad' };
  if (B.bekend[i]) return { tekst: 'Bekend van eerdere betaling (' + B.bekend[i] + ')', cls: 'ok' };
  return { tekst: 'Nieuw rekeningnummer – controleer dit op de factuur', cls: 'bad' };
}
function magMee(r) { return ibanGeldig(r.iban) && Number(r.bedrag) > 0 && (r.naam || '').trim().length > 1; }

async function voegToe(paden, opties = {}) {
  const msg = $('#betMsg');
  let nieuw = 0;
  const tel = { incasso: 0, betaald: 0, geenFactuur: 0 };
  for (const item of paden) {
    const p = typeof item === 'string' ? item : item.pad;
    const meta = typeof item === 'string' ? null : item;
    if (B.rijen.some((r) => r.pad === p)) continue;
    msg.textContent = 'Bezig met lezen: ' + p.split(/[\\/]/).pop();
    const res = await api.pdfTekst(p);
    const f = res.tekst ? leesFactuur(res.tekst, S.betaalIban) : { iban: '', bedrag: 0, nummer: '', naam: '', factuurdatum: '', vervaldatum: '', termijn: 0, kenmerk: '', incasso: false };
    const rij = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pad: p, bestand: meta ? meta.naam : p.split(/[\\/]/).pop(), ...f, leesfout: !!res.fout };
    if (meta) {
      rij.mail = { van: meta.van, onderwerp: meta.onderwerp, datum: meta.datum };
      B.verwerkt[meta.sleutel] = 1;
      if (!rij.naam || rij.naam.length < 3) rij.naam = meta.van;
    }
    // Uit de mail: alleen echte, nog te betalen facturen klaarzetten.
    if (opties.filter) {
      if (f.incasso) { tel.incasso++; continue; }
      if (!f.iban && !f.bedrag) { tel.geenFactuur++; continue; }
      if (B.betaald[sleutel(rij)]) { tel.betaald++; continue; }
    }
    if (B.bekend[ibanSchoon(rij.iban)] && !res.fout) rij.naam = B.bekend[ibanSchoon(rij.iban)];
    const d = bepaalDatum(rij);
    rij.datum = d.datum; rij.bron = d.bron; rij.telaat = d.telaat; rij.datumHandmatig = false;
    rij.mee = magMee(rij) && !rij.incasso && !!B.bekend[ibanSchoon(rij.iban)] && !B.betaald[sleutel(rij)];
    B.rijen.push(rij);
    nieuw++;
  }
  const extra = [tel.incasso && tel.incasso + ' incasso overgeslagen', tel.betaald && tel.betaald + ' al betaald', tel.geenFactuur && tel.geenFactuur + ' geen factuur herkend'].filter(Boolean).join(', ');
  msg.textContent = (nieuw ? nieuw + (nieuw === 1 ? ' factuur' : ' facturen') + ' klaargezet. Controleer de gegevens.' : 'Geen nieuwe facturen.') + (extra ? ' (' + extra + ')' : '');
  betSave();
  renderBetalen();
}

function veld(rij, key, attrs = {}) {
  const inp = el('input', Object.assign({ type: 'text', value: rij[key] == null ? '' : rij[key], 'aria-label': attrs.label || key }, attrs.extra || {}));
  inp.onchange = () => {
    let v = inp.value.trim();
    if (key === 'bedrag') { v = parseBedrag(v); inp.value = v ? v.toFixed(2).replace('.', ',') : ''; }
    if (key === 'iban') { v = ibanSchoon(v); inp.value = ibanMooi(v); }
    rij[key] = v;
    if (key === 'datum') { rij.datumHandmatig = true; rij.bron = 'Zelf ingesteld'; rij.telaat = false; }
    if (!magMee(rij)) rij.mee = false;
    betSave(); renderBetalen();
  };
  return inp;
}

function renderBetalen() {
  const body = $('#betRows');
  body.innerHTML = '';
  for (const r of B.rijen) {
    if (!r.datumHandmatig) { const d = bepaalDatum(r); r.datum = d.datum; r.bron = d.bron; r.telaat = d.telaat; }
    const st = ibanStatus(r);
    const dubbel = B.betaald[sleutel(r)];
    const cb = el('input', { type: 'checkbox', 'aria-label': 'Meenemen in betaalbestand: ' + (r.naam || r.bestand) });
    cb.checked = !!r.mee;
    cb.disabled = !magMee(r);
    cb.onchange = () => { r.mee = cb.checked; betSave(); renderTotaal(); };
    const datum = el('input', { type: 'date', value: r.datum, 'aria-label': 'Uitvoerdatum' });
    datum.onchange = () => { r.datum = datum.value; r.datumHandmatig = true; r.bron = 'Zelf ingesteld'; r.telaat = false; betSave(); renderBetalen(); };
    const notes = [];
    if (r.mail) notes.push(el('span', { class: 'tag' }, 'Uit mail van ' + r.mail.van + ' · ' + new Date(r.mail.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })));
    if (r.leesfout) notes.push(el('span', { class: 'tag bad' }, 'Pdf niet leesbaar – vul zelf in'));
    if (r.incasso) notes.push(el('span', { class: 'tag' }, 'Lijkt een incasso – niet aangevinkt'));
    if (dubbel) notes.push(el('span', { class: 'tag bad' }, 'Zat al in betaalbestand van ' + dubbel));
    body.append(el('tr', { class: r.mee ? 'on' : '' },
      el('td', {}, cb),
      el('td', {}, veld(r, 'naam', { label: 'Leverancier' }), el('div', { class: 'sub' }, 'Factuur ', veld(r, 'nummer', { label: 'Factuurnummer', extra: { class: 'mini', placeholder: 'nummer' } })), ...notes),
      el('td', { class: 'num' }, veld(r, 'bedrag', { label: 'Bedrag', extra: { class: 'num', value: r.bedrag ? Number(r.bedrag).toFixed(2).replace('.', ',') : '' } })),
      el('td', {}, datum, el('div', { class: 'sub' + (r.telaat ? ' bad' : '') }, r.bron)),
      el('td', {}, veld(r, 'iban', { label: 'Rekeningnummer', extra: { class: 'mono', value: ibanMooi(r.iban) } }), el('div', { class: 'sub ' + st.cls }, st.tekst)),
      el('td', { class: 'acts' },
        el('button', { class: 'btn', onclick: () => api.openBestand(r.pad) }, 'Bekijken'),
        el('button', { class: 'icon', 'aria-label': 'Verwijderen uit de lijst', title: 'Uit de lijst halen', html: ICON.trash, onclick: () => { B.rijen = B.rijen.filter((x) => x !== r); betSave(); renderBetalen(); } }))));
  }
  $('#betEmpty').hidden = B.rijen.length > 0;
  $('#betTable').hidden = B.rijen.length === 0;
  renderTotaal();
}
function renderTotaal() {
  const mee = B.rijen.filter((r) => r.mee && magMee(r));
  const tot = mee.reduce((s, r) => s + Number(r.bedrag), 0);
  $('#betTotaal').textContent = mee.length + (mee.length === 1 ? ' betaling · ' : ' betalingen · ') + euro(tot);
  $('#betMaak').disabled = !mee.length;
  document.querySelectorAll('#betRows tr').forEach((tr, i) => tr.classList.toggle('on', !!(B.rijen[i] && B.rijen[i].mee)));
}

/* ---------- SEPA-bestand ---------- */
function sepaTekst(s, max) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, '+').replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
function maakXml(rijen) {
  const nu = new Date();
  const stamp = iso(nu).replace(/-/g, '') + String(nu.getHours()).padStart(2, '0') + String(nu.getMinutes()).padStart(2, '0') + String(nu.getSeconds()).padStart(2, '0');
  const msgId = 'HOEKJE-' + stamp;
  const som = (rs) => rs.reduce((s, r) => s + Math.round(Number(r.bedrag) * 100), 0);
  const bedrag = (c) => (c / 100).toFixed(2);
  const naam = sepaTekst(S.betaalNaam, 70);
  const groepen = {};
  for (const r of rijen) (groepen[r.datum] = groepen[r.datum] || []).push(r);
  let n = 0;
  const blokken = Object.keys(groepen).sort().map((datum, gi) => {
    const rs = groepen[datum];
    const tx = rs.map((r) => {
      n++;
      const kenmerk = /^\d{7,16}$/.test(r.kenmerk || '') ? r.kenmerk : '';
      const rmt = kenmerk
        ? `<RmtInf><Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry><Issr>CUR</Issr></Tp><Ref>${kenmerk}</Ref></CdtrRefInf></Strd></RmtInf>`
        : `<RmtInf><Ustrd>${xmlEsc(sepaTekst(r.nummer ? 'Factuur ' + r.nummer : 'Factuur ' + r.bestand.replace(/\.pdf$/i, ''), 140))}</Ustrd></RmtInf>`;
      return `
      <CdtTrfTxInf>
        <PmtId><EndToEndId>${xmlEsc(sepaTekst((r.nummer || 'F' + n).replace(/\s/g, ''), 35) || 'NOTPROVIDED')}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${bedrag(Math.round(Number(r.bedrag) * 100))}</InstdAmt></Amt>
        <Cdtr><Nm>${xmlEsc(sepaTekst(r.naam, 70))}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${ibanSchoon(r.iban)}</IBAN></Id></CdtrAcct>
        ${rmt}
      </CdtTrfTxInf>`;
    }).join('');
    return `
    <PmtInf>
      <PmtInfId>${msgId}-${gi + 1}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${rs.length}</NbOfTxs>
      <CtrlSum>${bedrag(som(rs))}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${datum}</ReqdExctnDt>
      <Dbtr><Nm>${xmlEsc(naam)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${ibanSchoon(S.betaalIban)}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${xmlEsc(sepaTekst(S.betaalBic || 'RABONL2U', 11))}</BIC></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${tx}
    </PmtInf>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${iso(nu)}T${nu.toTimeString().slice(0, 8)}</CreDtTm>
      <NbOfTxs>${rijen.length}</NbOfTxs>
      <CtrlSum>${bedrag(som(rijen))}</CtrlSum>
      <InitgPty><Nm>${xmlEsc(naam)}</Nm></InitgPty>
    </GrpHdr>${blokken}
  </CstmrCdtTrfInitn>
</Document>
`;
}

async function maakBetaalbestand() {
  const msg = $('#betMsg');
  if (!ibanGeldig(S.betaalIban) || !(S.betaalNaam || '').trim()) {
    msg.textContent = 'Vul eerst bij Instellingen › Betalen de naam en het rekeningnummer van jullie eigen rekening in.';
    return;
  }
  const rijen = B.rijen.filter((r) => r.mee && magMee(r));
  if (!rijen.length) return;
  const xml = maakXml(rijen);
  const nu = new Date();
  const naam = `Betaalbestand-${iso(nu)}-${String(nu.getHours()).padStart(2, '0')}${String(nu.getMinutes()).padStart(2, '0')}.xml`;
  const res = await api.bewaarBetaalbestand(xml, naam);
  if (res.fout) { msg.textContent = 'Bewaren lukte niet: ' + res.fout; return; }
  const dag = nlDatum(iso(nu));
  for (const r of rijen) {
    B.bekend[ibanSchoon(r.iban)] = (r.naam || '').trim();
    B.betaald[sleutel(r)] = dag;
  }
  B.rijen = B.rijen.filter((r) => !rijen.includes(r));
  B.laatste = { pad: res.pad, naam, aantal: rijen.length, totaal: rijen.reduce((s, r) => s + Number(r.bedrag), 0) };
  betSave();
  msg.textContent = '';
  renderBetalen();
  renderKlaar();
}
function renderKlaar() {
  const box = $('#betKlaar');
  const l = B.laatste;
  box.hidden = !l;
  if (!l) return;
  $('#betKlaarTekst').textContent = `${l.naam} · ${l.aantal} ${l.aantal === 1 ? 'betaling' : 'betalingen'} · ${euro(l.totaal)} · staat in je map Downloads`;
}

/* ---------- Bekende rekeningnummers uit een Rabobank-CSV ---------- */
function leesCsv(tekst) {
  const regels = tekst.split(/\r?\n/).filter(Boolean);
  const kop = regels.shift().split('","').map((x) => x.replace(/"/g, ''));
  const iI = kop.findIndex((k) => /^Tegenrekening IBAN/i.test(k));
  const iN = kop.findIndex((k) => /^Naam tegenpartij/i.test(k));
  const iB = kop.findIndex((k) => /^Bedrag/i.test(k));
  if (iI < 0 || iN < 0) return 0;
  let n = 0;
  for (const r of regels) {
    const c = r.replace(/^"|"$/g, '').split('","');
    const iban = ibanSchoon(c[iI]);
    if (!ibanGeldig(iban) || iban === ibanSchoon(S.betaalIban)) continue;
    if (iB >= 0 && !String(c[iB]).startsWith('-')) continue; // alleen afschrijvingen
    if (!B.bekend[iban]) { B.bekend[iban] = (c[iN] || '').trim(); n++; }
  }
  betSave();
  return n;
}

/* ---------- Opbouw ---------- */
async function renderRecent() {
  const lijst = $('#betRecent');
  lijst.innerHTML = '';
  const items = await api.recentePdfs();
  const nieuw = items.filter((x) => !B.rijen.some((r) => r.pad === x.pad));
  if (!nieuw.length) { lijst.append(el('li', { class: 'small' }, "Geen nieuwe pdf's in Downloads van de afgelopen 30 dagen.")); return; }
  for (const x of nieuw.slice(0, 12)) {
    const d = new Date(x.tijd);
    lijst.append(el('li', {}, el('button', { class: 'pick', onclick: () => voegToe([x.pad]).then(renderRecent) },
      el('span', { class: 'plus', 'aria-hidden': 'true' }, '+'),
      el('span', { class: 'fn' }, x.naam),
      el('span', { class: 'small' }, d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })))));
  }
}

/* ---------- Facturen uit de mailbox ---------- */
async function zoekInMail(stil) {
  const msg = $('#betMsg');
  const knop = $('#betMail');
  const st = await api.msStatus();
  if (!st.gekoppeld) {
    if (!stil) msg.textContent = 'Koppel eerst je mailbox: Instellingen › Microsoft-koppeling.';
    return;
  }
  knop.disabled = true;
  msg.textContent = 'Bezig met zoeken in je mail…';
  const res = await api.mailFacturen(S.mailDagen || 30);
  knop.disabled = false;
  if (res.fout) { msg.textContent = 'Zoeken in de mail lukte niet: ' + res.fout; return; }
  B.laatsteMailZoek = Date.now();
  const nieuw = res.bijlagen.filter((b) => !B.verwerkt[b.sleutel]);
  if (!nieuw.length) { msg.textContent = `${res.mails} mails met bijlagen bekeken, geen nieuwe facturen.`; betSave(); return; }
  await voegToe(nieuw, { filter: true });
}

function initBetalen() {
  if (!api || !api.pdfTekst) return;
  const drop = $('#betDrop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const files = [...e.dataTransfer.files];
    const csv = files.find((f) => /\.csv$/i.test(f.name));
    if (csv) { const n = leesCsv(await csv.text()); $('#betMsg').textContent = n + ' rekeningnummers van eerdere betalingen onthouden.'; renderBetalen(); }
    const paden = files.filter((f) => /\.pdf$/i.test(f.name)).map((f) => api.pad(f)).filter(Boolean);
    if (paden.length) await voegToe(paden);
    renderRecent();
  });
  $('#betMail').onclick = () => zoekInMail(false);
  $('#betKies').onclick = async () => { const p = await api.kiesPdfs(); if (p.length) { await voegToe(p); renderRecent(); } };
  $('#betCsv').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const n = leesCsv(await f.text()); $('#betMsg').textContent = n + ' rekeningnummers van eerdere betalingen onthouden.'; e.target.value = ''; renderBetalen(); };
  $('#betMaak').onclick = maakBetaalbestand;
  $('#betAlles').onclick = () => { for (const r of B.rijen) if (magMee(r) && !r.incasso && B.bekend[ibanSchoon(r.iban)] && !B.betaald[sleutel(r)]) r.mee = true; betSave(); renderBetalen(); };
  $('#betSleep').addEventListener('dragstart', (e) => { e.preventDefault(); if (B.laatste) api.sleepBestand(B.laatste.pad); });
  $('#betToon').onclick = () => B.laatste && api.toonBestand(B.laatste.pad);
  $('#betRabo').onclick = () => { const t = S.tabs.find((x) => /rabo/i.test(x.name + x.url)); open(t ? 'tab-' + t.id : 'browser'); };
  $('#betSluit').onclick = () => { B.laatste = null; betSave(); renderKlaar(); };
  renderBetalen();
  renderKlaar();
}
function betalenGetoond() {
  if (!api || !api.recentePdfs) return;
  renderBetalen();
  renderRecent();
  // Elk uur hooguit één keer vanzelf in de mail zoeken.
  if (api.mailFacturen && (!B.laatsteMailZoek || Date.now() - B.laatsteMailZoek > 3600e3)) zoekInMail(true);
}
initBetalen();
