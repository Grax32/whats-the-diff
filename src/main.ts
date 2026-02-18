import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent, OpenDialogReturnValue } from 'electron';
import * as path from 'path';
import { promises as fs } from 'fs';

let mainWindow: BrowserWindow | null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

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

// IPC handlers
ipcMain.handle('load-config', async (_event: IpcMainInvokeEvent): Promise<Config | null> => {
  const result: OpenDialogReturnValue = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const configPath = result.filePaths[0];
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent) as Config;
  }
  return null;
});

ipcMain.handle('compare-directories', async (_event: IpcMainInvokeEvent, leftDir: string, rightDir: string): Promise<FileDifference[]> => {
  const differences = await compareDirectories(leftDir, rightDir);
  return differences;
});

ipcMain.handle('copy-file', async (_event: IpcMainInvokeEvent, sourcePath: string, destPath: string, direction: string): Promise<CopyFileResult> => {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    
    // Copy the file
    await fs.copyFile(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

async function compareDirectories(leftDir: string, rightDir: string): Promise<FileDifference[]> {
  const differences: FileDifference[] = [];
  
  async function scanDirectory(dir: string, relativePath: string = ''): Promise<void> {
    const items = await fs.readdir(path.join(dir, relativePath), { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(relativePath, item.name);
      
      if (item.isDirectory()) {
        await scanDirectory(dir, itemPath);
      } else {
        const leftPath = path.join(leftDir, itemPath);
        const rightPath = path.join(rightDir, itemPath);
        
        const leftExists = await fileExists(leftPath);
        const rightExists = await fileExists(rightPath);
        
        if (leftExists && rightExists) {
          const leftContent = await fs.readFile(leftPath);
          const rightContent = await fs.readFile(rightPath);
          
          if (!leftContent.equals(rightContent)) {
            const leftStat = await fs.stat(leftPath);
            const rightStat = await fs.stat(rightPath);
            
            differences.push({
              type: 'modified',
              path: itemPath,
              leftPath,
              rightPath,
              leftSize: leftStat.size,
              rightSize: rightStat.size,
              leftModified: leftStat.mtime.toISOString(),
              rightModified: rightStat.mtime.toISOString()
            });
          }
        } else if (leftExists && !rightExists) {
          const leftStat = await fs.stat(leftPath);
          differences.push({
            type: 'left-only',
            path: itemPath,
            leftPath,
            rightPath,
            leftSize: leftStat.size,
            leftModified: leftStat.mtime.toISOString()
          });
        } else if (!leftExists && rightExists) {
          const rightStat = await fs.stat(rightPath);
          differences.push({
            type: 'right-only',
            path: itemPath,
            leftPath,
            rightPath,
            rightSize: rightStat.size,
            rightModified: rightStat.mtime.toISOString()
          });
        }
      }
    }
  }
  
  // Scan both directories
  await scanDirectory(leftDir);
  await scanDirectory(rightDir);
  
  // Remove duplicates and sort
  const uniqueDiffs = Array.from(new Map(differences.map(d => [d.path, d])).values());
  return uniqueDiffs.sort((a, b) => a.path.localeCompare(b.path));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
