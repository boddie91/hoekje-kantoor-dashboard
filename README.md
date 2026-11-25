# Hoekje kantoor – dashboard

Eigen Windows-app (Electron) voor de administratie van Café Cafetaria 't Hoekje, Lemelerveld.
Eigenaar: Jasmijn (boddie91). Alle tekst in de interface is Nederlands.
Doel: **zo min mogelijk nadenkwerk** – bij elke wijziging eerst vragen: "bespaart dit haar een beslissing of een handeling?"

Ontwerp (alle schermen, ook wat nog gebouwd moet worden): https://claude.ai/artifact/VzyrRov3dZbHtcycw8pg9M

## Bestanden

| Map / bestand | Wat |
|---|---|
| `app/main.js` | Hoofdproces: venster, sessie, logboek, automatisch bijwerken vanaf GitHub. |
| `app/preload.js` | Brug naar het dashboard (alleen voor bijwerken en versie). |
| `app/index.html`, `app/app.js`, `app/style.css` | Het dashboard zelf (geen framework, geen build-stap). |
| `app/icon.ico` | Pictogram. |
| `app/package.json` | Naam en **versienummer** (verhoog bij elke wijziging). |
| `installeren/Installeren.cmd` + `installeren.ps1` | Eenmalige installatie op een pc: downloadt Electron en deze repo, zet de app in `%LOCALAPPDATA%\HoekjeKantoor\app`, maakt de snelkoppeling op het bureaublad. |

## Hoe bijwerken werkt
- De app vergelijkt bij het opstarten (en elke 3 uur) de bestanden in `app/` op `main` met de eigen bestanden
  (Git-controlegetallen via de GitHub-API). Gewijzigde bestanden worden gedownload, gecontroleerd en vervangen;
  bovenin verschijnt "Opnieuw starten". Een push naar `main` is dus genoeg om de app bij te werken.
- Alleen bestanden direct in `app/` (geen submappen). Een nieuw bestand in `app/` komt ook vanzelf mee.
- Opnieuw installeren is alleen nodig voor een andere Electron-versie (`$electronVersie` in `installeren.ps1`).
- `.gitattributes` zet regeleinde-conversie uit, zodat de controlegetallen kloppen.

## Techniek
- Electron 38 (Chromium). Websites draaien in `<webview>` met partitie `persist:hoekje`, zodat aanmeldingen bewaard blijven.
- User-agent = standaard Chrome zonder "Electron" (anders blijven inlogpagina's van Microsoft en Exact hangen).
- Meldingen van websites worden geweigerd (permission handler).
- Snelheid: websites op het overzicht laden na elkaar (Exact links direct, Outlook na 2,5 s, Grootboek na 6 s, Exact rechts pas als gesplitst scherm aan staat).
  "Groot openen" en de zijbalkknoppen Outlook/Grootboek/Exact vergroten het vak op het overzicht (`.grid[data-focus]`) in plaats van een tweede kopie te laden. Elke `<webview>` is een eigen proces: wees zuinig.
- Instellingen in `localStorage` (`hoekje-kantoor-instellingen`). Later naar Supabase (zelfde project als de Grootboek Sorteerder, `hh_*`-tabellen niet aanraken).
- Logboek: `%LOCALAPPDATA%\HoekjeKantoor\app-log.txt` (navigaties zonder zoekgedeelte, fouten, updates). Geen wachtwoorden of tokens loggen.
- Kleuren: donker `#18202B`, blauw `#2456C8`, groen `#3D6B5C`, rood `#B34D4D`, achtergrond `#EEF1F5`, randen `#D8DEE6`.

## Werken aan de app (voor Claude)
1. Eerst `git pull`: er kan in een andere chat iets veranderd zijn.
2. Wijzig de bestanden in `app/`, verhoog `version` in `app/package.json`, controleer met `node --check`.
3. Commit en push naar `main`. De app haalt het zelf op; de gebruiker klikt alleen op "Opnieuw starten".
4. Vanuit de sandbox is de app nooit echt gestart: wees eerlijk over wat getest is en vraag de gebruiker om te testen.
   Bij problemen: vraag toegang tot `%LOCALAPPDATA%\HoekjeKantoor` en lees `app-log.txt`.

## Gebouwd (v0.7)
Zijbalk, Exact Online met gesplitst scherm, Outlook, Grootboek Sorteerder (https://boddie91.github.io/grootboek-sorteerder/),
rekenmachine, Radio 2/focus-muziek, website-tabbladen (Rabobank, Mijn KPN, Exact, Dropbox, Kassa), instellingenpagina,
versleepbare tegelbreedtes, automatisch bijwerken.

**Betalen (v0.5, `app/betalen.js`)**: factuur-pdf's slepen/kiezen of uit "Nieuw in Downloads" (laatste 30 dagen) →
tekst lezen in het hoofdproces met pdf.js (`pdf.min.mjs` + `pdf.worker.min.mjs`, legacy build 6.2.108, Apache-2.0, zie `LICENSE-pdfjs.txt`;
in Node is een eenvoudige `DOMMatrix`-vervanger nodig) → leverancier, IBAN (mod-97), bedrag, factuurnummer, factuur-/vervaldatum,
termijn, betalingskenmerk en incasso herkennen → uitvoerdatum per factuur (uiterste datum, of factuurdatum + termijn,
of standaardtermijn; N werkdagen eerder; weekend/TARGET-feestdagen overgeslagen) → pain.001.001.03 met één `PmtInf` per
uitvoerdatum, opgeslagen in Downloads; als bestand naar Rabobank te slepen (`startDrag`).
Veiligheid: een rekeningnummer dat niet bekend is (eerder betaald of uit een ingelezen Rabobank-CSV) wordt nooit vanzelf
aangevinkt; facturen die al in een eerder betaalbestand zaten worden gemarkeerd. Eigen rekening (naam, IBAN, BIC) staat
alleen lokaal in de instellingen, **nooit in deze openbare repo**. Gegevens: `localStorage` `hoekje-kantoor-betalen`.

**To-do (v0.8, `app/todo.js`)**: rechterkolom op het overzicht. Eigen taken (tekst + optionele datum, afvinken, verwijderen;
afgeronde taken een week zichtbaar) en automatische taken uit Betalen (facturen te betalen met eerste uitvoerdatum,
betaalbestand nog tekenen, fout in de mailkoppeling) en de reservekopie. Een automatische taak afvinken verbergt hem tot
de situatie verandert (`weg[key] = signatuur`). Op de achtergrond elk uur zoeken in de mail. Opslag `localStorage`
`hoekje-kantoor-todo`, eigen taken gaan mee in de Betalen-reservekopie. Rekenmachine en muziek staan nu naast elkaar.

## Nog te bouwen (zie ontwerp)
1. Klembord (wens van Jasmijn, 25-11): een **brede balk bovenaan** (niet aan de zijkant) met per item: slepen, kopiëren,
   verwijderen en **opslaan in Dropbox**. Items: gedownloade bestanden (pdf's uit Outlook, betaalbestanden), gekopieerde tekst.
2. Alle Windows-meldingen dempen zolang de app open is.
3. Afschrijvingen (Rabobank-CSV) koppelen aan factuurmails; ontbrekende facturen opvragen via concept-mails
   (e-mailadres zoeken: eerst eerdere mails, dan internet); "geen factuur nodig" per tegenpartij onthouden.
4. Betalen uitbreiden: facturen rechtstreeks uit de mailbox halen in plaats van via Downloads; klembord.
5. Facturenoverzicht met status per factuur; teller op de knop Betalen; archiveren in Dropbox per kwartaal.
6. Instellingen naar Supabase.

**Grootboek Sorteerder-koppeling (v0.5.1/v0.6)**: downloads uit websites gaan zonder venster naar Downloads; een pdf die in
Outlook wordt gedownload gaat via `window.grootboekLaadPdf` naar de Grootboek Sorteerder (instelling `gbAuto`).
Elke 5 minuten leest het dashboard `localStorage['grootboek-sorteerder-leveranciers']` uit de Grootboek-webview en schrijft
die (bij wijziging) naar `<Dropbox>/Hoekje kantoor/Grootboek boekingsregels/` (`boekingsregels-laatste.json` + één per dag,
90 dagen). Sinds v0.7.5 ook het geheugen van Betalen (`betaald`, `bekend`, `incasso`, `incassoAfzender`, `incassoPrefix`, `verwerkt`)
in `<Dropbox>/Hoekje kantoor/Betalen/` (`betalen-laatste.json` + per dag); bij een lege installatie wordt dat automatisch teruggezet. Dropbox-map uit `%LOCALAPPDATA%\Dropbox\info.json`. Formaat = de handmatige back-up van de Grootboek Sorteerder.

**Microsoft-koppeling (v0.7)**: Microsoft Graph met eigen app-registratie van de gebruiker (alleen persoonlijke
Microsoft-accounts, platform "Openbare client", redirect `https://login.microsoftonline.com/common/oauth2/nativeclient`,
gedelegeerde rechten `Mail.Read`, `User.Read`, `offline_access`). Client-id staat in de instellingen (`msClientId`, niet geheim).
PKCE-inlog in een modaal venster; vernieuwingssleutel versleuteld (safeStorage) in `%LOCALAPPDATA%\HoekjeKantoor\microsoft.bin`.
`mail-facturen` zoekt mails met bijlagen van de laatste `mailDagen` dagen (max. 300 mails), downloadt pdf-bijlagen naar
`%LOCALAPPDATA%\HoekjeKantoor\mail-pdf\`; Betalen slaat incasso's, al betaalde en niet-herkende pdf's over en onthoudt
verwerkte bijlagen (`verwerkt`). Zoekt vanzelf hooguit eens per uur bij het openen van Betalen.
Voor concept-mails (ontbrekende facturen opvragen) is later `Mail.ReadWrite` nodig: opnieuw koppelen.

Apart project, later: betaalverzoeken aan debiteuren uit de kassa (MplusKASSA) via WhatsApp met één betaallink.
