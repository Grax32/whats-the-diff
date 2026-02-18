const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
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

// IPC handlers
ipcMain.handle('load-config', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const configPath = result.filePaths[0];
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  }
  return null;
});

ipcMain.handle('compare-directories', async (event, leftDir, rightDir) => {
  const differences = await compareDirectories(leftDir, rightDir);
  return differences;
});

ipcMain.handle('copy-file', async (event, sourcePath, destPath, direction) => {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    
    // Copy the file
    await fs.copyFile(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function compareDirectories(leftDir, rightDir) {
  const differences = [];
  
  async function scanDirectory(dir, relativePath = '') {
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
