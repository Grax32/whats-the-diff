interface Config {
  leftDirectory: string;
  rightDirectory: string;
}

interface FileDifference {
  type: 'modified' | 'left-only' | 'right-only' | 'synced';
  path: string;
  leftPath: string;
  rightPath: string;
  leftSize?: number;
  rightSize?: number;
  leftModified?: string;
  rightModified?: string;
}

interface CopyFileResult {
  success: boolean;
  error?: string;
}

interface ElectronAPI {
  loadConfig: () => Promise<Config | null>;
  compareDirectories: (leftDir: string, rightDir: string) => Promise<FileDifference[]>;
  copyFile: (sourcePath: string, destPath: string, direction: string) => Promise<CopyFileResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

let currentConfig: Config | null = null;
let differences: FileDifference[] = [];
let ignoredFiles = new Set<string>();

// DOM elements
const loadConfigBtn = document.getElementById('loadConfigBtn') as HTMLButtonElement;
const compareBtn = document.getElementById('compareBtn') as HTMLButtonElement;
const configStatus = document.getElementById('configStatus') as HTMLElement;
const leftDirPath = document.getElementById('leftDirPath') as HTMLElement;
const rightDirPath = document.getElementById('rightDirPath') as HTMLElement;
const resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
const diffCount = document.getElementById('diffCount') as HTMLElement;

// Event listeners
loadConfigBtn.addEventListener('click', loadConfig);
compareBtn.addEventListener('click', compareDirectories);

async function loadConfig(): Promise<void> {
  try {
    const config = await window.electronAPI.loadConfig();
    
    if (config) {
      currentConfig = config;
      
      // Update UI
      leftDirPath.textContent = config.leftDirectory || 'Not specified in config';
      rightDirPath.textContent = config.rightDirectory || 'Not specified in config';
      configStatus.textContent = '✓ Config loaded successfully';
      
      // Enable compare button if both directories are set
      if (config.leftDirectory && config.rightDirectory) {
        compareBtn.disabled = false;
      }
    }
  } catch (error) {
    configStatus.textContent = `✗ Error loading config: ${(error as Error).message}`;
    configStatus.style.color = '#dc3545';
  }
}

async function compareDirectories(): Promise<void> {
  if (!currentConfig || !currentConfig.leftDirectory || !currentConfig.rightDirectory) {
    alert('Please load a valid config file first');
    return;
  }

  compareBtn.disabled = true;
  compareBtn.textContent = 'Comparing...';
  resultsContainer.innerHTML = '<div class="empty-state"><p>Comparing directories...</p></div>';

  try {
    differences = await window.electronAPI.compareDirectories(
      currentConfig.leftDirectory,
      currentConfig.rightDirectory
    );

    ignoredFiles.clear();
    displayResults();
    
    compareBtn.textContent = 'Compare Directories';
    compareBtn.disabled = false;
  } catch (error) {
    resultsContainer.innerHTML = `
      <div class="status-message status-error">
        Error comparing directories: ${(error as Error).message}
      </div>
    `;
    compareBtn.textContent = 'Compare Directories';
    compareBtn.disabled = false;
  }
}

function displayResults(): void {
  if (differences.length === 0) {
    resultsContainer.innerHTML = '<div class="empty-state"><p>No differences found. Directories are in sync!</p></div>';
    diffCount.textContent = '0';
    return;
  }

  const visibleDiffs = differences.filter(d => !ignoredFiles.has(d.path));
  diffCount.textContent = visibleDiffs.length.toString();

  resultsContainer.innerHTML = '';

  differences.forEach(diff => {
    const diffItem = createDiffItem(diff);
    resultsContainer.appendChild(diffItem);
  });
}

function createDiffItem(diff: FileDifference): HTMLElement {
  const item = document.createElement('div');
  item.className = 'diff-item';
  if (ignoredFiles.has(diff.path)) {
    item.classList.add('ignored');
  }

  const badge = getBadge(diff.type);
  const typeLabel = getTypeLabel(diff.type);

  item.innerHTML = `
    <div class="diff-header">
      <div class="diff-path">
        <span class="badge ${badge.class}">${badge.text}</span>
        <span class="diff-path-text">${diff.path}</span>
      </div>
      <div class="diff-actions">
        ${createActionButtons(diff)}
      </div>
    </div>
    <div class="diff-details">
      ${createDetailsHTML(diff)}
    </div>
  `;

  // Add event listeners to buttons
  const copyLeftBtn = item.querySelector('.copy-left') as HTMLButtonElement | null;
  const copyRightBtn = item.querySelector('.copy-right') as HTMLButtonElement | null;
  const ignoreBtn = item.querySelector('.ignore') as HTMLButtonElement | null;

  if (copyLeftBtn) {
    copyLeftBtn.addEventListener('click', () => copyLeftToRight(diff, item));
  }
  if (copyRightBtn) {
    copyRightBtn.addEventListener('click', () => copyRightToLeft(diff, item));
  }
  if (ignoreBtn) {
    ignoreBtn.addEventListener('click', () => toggleIgnore(diff, item));
  }

  return item;
}

function getBadge(type: string): { text: string; class: string } {
  switch (type) {
    case 'modified':
      return { text: 'M', class: 'badge-modified' };
    case 'left-only':
      return { text: 'L', class: 'badge-left' };
    case 'right-only':
      return { text: 'R', class: 'badge-right' };
    default:
      return { text: '?', class: '' };
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'modified':
      return 'Modified';
    case 'left-only':
      return 'Left Only';
    case 'right-only':
      return 'Right Only';
    default:
      return 'Unknown';
  }
}

function createActionButtons(diff: FileDifference): string {
  const buttons: string[] = [];

  if (diff.type === 'modified' || diff.type === 'left-only') {
    buttons.push('<button class="btn btn-action btn-copy-left copy-left">Copy L→R</button>');
  }

  if (diff.type === 'modified' || diff.type === 'right-only') {
    buttons.push('<button class="btn btn-action btn-copy-right copy-right">Copy R→L</button>');
  }

  buttons.push('<button class="btn btn-action btn-ignore ignore">Ignore</button>');

  return buttons.join('');
}

function createDetailsHTML(diff: FileDifference): string {
  let html = '';

  // Left side
  html += '<div class="diff-side">';
  html += '<div class="diff-side-title">Left</div>';
  html += '<div class="diff-side-info">';
  
  if (diff.type === 'left-only' || diff.type === 'modified') {
    html += `<div class="info-row"><span class="info-label">Size:</span><span class="info-value">${formatBytes(diff.leftSize)}</span></div>`;
    if (diff.leftModified) {
      html += `<div class="info-row"><span class="info-label">Modified:</span><span class="info-value">${formatDate(diff.leftModified)}</span></div>`;
    }
  } else {
    html += '<div class="info-row"><span class="info-value">File not present</span></div>';
  }
  
  html += '</div>';
  html += '</div>';

  // Right side
  html += '<div class="diff-side">';
  html += '<div class="diff-side-title">Right</div>';
  html += '<div class="diff-side-info">';
  
  if (diff.type === 'right-only' || diff.type === 'modified') {
    html += `<div class="info-row"><span class="info-label">Size:</span><span class="info-value">${formatBytes(diff.rightSize)}</span></div>`;
    if (diff.rightModified) {
      html += `<div class="info-row"><span class="info-label">Modified:</span><span class="info-value">${formatDate(diff.rightModified)}</span></div>`;
    }
  } else {
    html += '<div class="info-row"><span class="info-value">File not present</span></div>';
  }
  
  html += '</div>';
  html += '</div>';

  return html;
}

async function copyLeftToRight(diff: FileDifference, itemElement: HTMLElement): Promise<void> {
  const result = await window.electronAPI.copyFile(diff.leftPath, diff.rightPath, 'left-to-right');
  
  if (result.success) {
    showStatusMessage(itemElement, 'Successfully copied left to right', 'success');
    // Update the diff object
    diff.type = 'synced';
    setTimeout(() => {
      itemElement.style.opacity = '0';
      setTimeout(() => {
        differences = differences.filter(d => d.path !== diff.path);
        displayResults();
      }, 300);
    }, 1000);
  } else {
    showStatusMessage(itemElement, `Error: ${result.error}`, 'error');
  }
}

async function copyRightToLeft(diff: FileDifference, itemElement: HTMLElement): Promise<void> {
  const result = await window.electronAPI.copyFile(diff.rightPath, diff.leftPath, 'right-to-left');
  
  if (result.success) {
    showStatusMessage(itemElement, 'Successfully copied right to left', 'success');
    // Update the diff object
    diff.type = 'synced';
    setTimeout(() => {
      itemElement.style.opacity = '0';
      setTimeout(() => {
        differences = differences.filter(d => d.path !== diff.path);
        displayResults();
      }, 300);
    }, 1000);
  } else {
    showStatusMessage(itemElement, `Error: ${result.error}`, 'error');
  }
}

function toggleIgnore(diff: FileDifference, itemElement: HTMLElement): void {
  if (ignoredFiles.has(diff.path)) {
    ignoredFiles.delete(diff.path);
    itemElement.classList.remove('ignored');
  } else {
    ignoredFiles.add(diff.path);
    itemElement.classList.add('ignored');
  }
  
  // Update count
  const visibleDiffs = differences.filter(d => !ignoredFiles.has(d.path));
  diffCount.textContent = visibleDiffs.length.toString();
}

function showStatusMessage(itemElement: HTMLElement, message: string, type: string): void {
  const existingMsg = itemElement.querySelector('.status-message');
  if (existingMsg) {
    existingMsg.remove();
  }

  const statusDiv = document.createElement('div');
  statusDiv.className = `status-message status-${type}`;
  statusDiv.textContent = message;
  itemElement.appendChild(statusDiv);

  if (type === 'success') {
    setTimeout(() => {
      statusDiv.remove();
    }, 2000);
  }
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === 0 || bytes === undefined) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Export an empty object to make this a module
export {};
