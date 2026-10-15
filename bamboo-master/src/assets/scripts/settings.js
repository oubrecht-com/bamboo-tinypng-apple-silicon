import { ipcRenderer } from 'electron';

// Synchronous settings access, backed by the main process store
export default {
  get: key => ipcRenderer.sendSync('settings-get', key),
  set: (key, value) => ipcRenderer.sendSync('settings-set', key, value)
};
