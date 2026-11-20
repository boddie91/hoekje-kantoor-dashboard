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
- Instellingen in `localStorage` (`hoekje-kantoor-instellingen`). Later naar Supabase (zelfde project als de Grootboek Sorteerder, `hh_*`-tabellen niet aanraken).
- Logboek: `%LOCALAPPDATA%\HoekjeKantoor\app-log.txt` (navigaties zonder zoekgedeelte, fouten, updates). Geen wachtwoorden of tokens loggen.
- Kleuren: donker `#18202B`, blauw `#2456C8`, groen `#3D6B5C`, rood `#B34D4D`, achtergrond `#EEF1F5`, randen `#D8DEE6`.

## Werken aan de app (voor Claude)
1. Eerst `git pull`: er kan in een andere chat iets veranderd zijn.
2. Wijzig de bestanden in `app/`, verhoog `version` in `app/package.json`, controleer met `node --check`.
3. Commit en push naar `main`. De app haalt het zelf op; de gebruiker klikt alleen op "Opnieuw starten".
4. Vanuit de sandbox is de app nooit echt gestart: wees eerlijk over wat getest is en vraag de gebruiker om te testen.
   Bij problemen: vraag toegang tot `%LOCALAPPDATA%\HoekjeKantoor` en lees `app-log.txt`.

## Gebouwd (v0.3)
Zijbalk, Exact Online met gesplitst scherm, Outlook, Grootboek Sorteerder (https://boddie91.github.io/grootboek-sorteerder/),
rekenmachine, Radio 2/focus-muziek, website-tabbladen (Rabobank, Mijn KPN, Exact, Dropbox, Kassa), instellingenpagina,
versleepbare tegelbreedtes, automatisch bijwerken.

## Nog te bouwen (zie ontwerp)
1. Klembord (gedownloade/gekopieerde bestanden slepen tussen onderdelen).
2. Alle Windows-meldingen dempen zolang de app open is.
3. Afschrijvingen (Rabobank-CSV) koppelen aan factuurmails; ontbrekende facturen opvragen via concept-mails
   (e-mailadres zoeken: eerst eerdere mails, dan internet); "geen factuur nodig" per tegenpartij onthouden.
4. Betalen: te betalen facturen uit de mail → betaalbestand pain.001.001.03 met uitvoerdatum per factuur
   (uiterste datum / termijn / standaard), nieuw IBAN rood en nooit vanzelf aangevinkt, bestand naar het klembord.
5. Facturenoverzicht met status per factuur; teller op de knop Betalen; archiveren in Dropbox per kwartaal.
6. Instellingen naar Supabase.

Apart project, later: betaalverzoeken aan debiteuren uit de kassa (MplusKASSA) via WhatsApp met één betaallink.
