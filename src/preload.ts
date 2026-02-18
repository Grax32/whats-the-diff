import { contextBridge, ipcRenderer } from 'electron';

interface Config {
  leftDirectory: string;
  rightDirectory: string;
}

interface CopyFileResult {
  success: boolean;
  error?: string;
}

interface FileDifference {
  type: 'modified' | 'left-only' | 'right-only';
  path: string;
  leftPath: string;
  rightPath: string;
  leftSize?: number;
  rightSize?: number;
  leftModified?: string;
  rightModified?: string;
}

interface ElectronAPI {
  loadConfig: () => Promise<Config | null>;
  compareDirectories: (leftDir: string, rightDir: string) => Promise<FileDifference[]>;
  copyFile: (sourcePath: string, destPath: string, direction: string) => Promise<CopyFileResult>;
}

contextBridge.exposeInMainWorld('electronAPI', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  compareDirectories: (leftDir: string, rightDir: string) => ipcRenderer.invoke('compare-directories', leftDir, rightDir),
  copyFile: (sourcePath: string, destPath: string, direction: string) => ipcRenderer.invoke('copy-file', sourcePath, destPath, direction)
} as ElectronAPI);
