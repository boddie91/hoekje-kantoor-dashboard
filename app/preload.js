// Brug tussen het dashboard en het hoofdproces, alleen voor bijwerken.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hoekje', {
  opUpdate: (cb) => ipcRenderer.on('update-klaar', () => cb()),
  zoekUpdate: () => ipcRenderer.invoke('zoek-update'),
  versie: () => ipcRenderer.invoke('versie'),
  herstart: () => ipcRenderer.send('herstart'),
});
