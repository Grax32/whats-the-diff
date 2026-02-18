const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  compareDirectories: (leftDir, rightDir) => ipcRenderer.invoke('compare-directories', leftDir, rightDir),
  copyFile: (sourcePath, destPath, direction) => ipcRenderer.invoke('copy-file', sourcePath, destPath, direction)
});
