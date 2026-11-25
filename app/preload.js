// Brug tussen het dashboard en het hoofdproces: bijwerken en betalen.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('hoekje', {
  opUpdate: (cb) => ipcRenderer.on('update-klaar', () => cb()),
  zoekUpdate: () => ipcRenderer.invoke('zoek-update'),
  versie: () => ipcRenderer.invoke('versie'),
  herstart: () => ipcRenderer.send('herstart'),
  pad: (file) => webUtils.getPathForFile(file),
  pdfTekst: (p) => ipcRenderer.invoke('pdf-tekst', p),
  recentePdfs: () => ipcRenderer.invoke('recente-pdfs'),
  kiesPdfs: () => ipcRenderer.invoke('kies-pdfs'),
  bewaarBetaalbestand: (xml, naam) => ipcRenderer.invoke('bewaar-betaalbestand', xml, naam),
  toonBestand: (p) => ipcRenderer.send('toon-bestand', p),
  openBestand: (p) => ipcRenderer.send('open-bestand', p),
  sleepBestand: (p) => ipcRenderer.send('sleep-bestand', p),
});
