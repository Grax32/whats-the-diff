import { contextBridge, ipcRenderer } from 'electron';

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
  selectDirectory: () => Promise<string | null>;
  compareDirectories: (leftDir: string, rightDir: string) => Promise<FileDifference[]>;
  copyFile: (sourcePath: string, destPath: string, direction: string) => Promise<CopyFileResult>;
  readFile: (filePath: string) => Promise<string | null>;
}

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  compareDirectories: (leftDir: string, rightDir: string) => ipcRenderer.invoke('compare-directories', leftDir, rightDir),
  copyFile: (sourcePath: string, destPath: string, direction: string) => ipcRenderer.invoke('copy-file', sourcePath, destPath, direction),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath)
} as ElectronAPI);
