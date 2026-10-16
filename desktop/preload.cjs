// Exposes the saved KDS server URL to the React build (apiService.js reads
// window.kdsDesktop.backendUrl before falling back to REACT_APP_BACKEND_URL).
const { contextBridge, ipcRenderer } = require('electron');

const cfg = ipcRenderer.sendSync('kds:get-config') || {};

contextBridge.exposeInMainWorld('kdsDesktop', {
  isDesktop: true,
  backendUrl: cfg.backendUrl || '',
  saveBackend: (url) => ipcRenderer.invoke('kds:save-backend', url),
  openSetup: () => ipcRenderer.send('kds:open-setup'),
});
