import * as Diff from 'diff';

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
  selectDirectory: () => Promise<string | null>;
  compareDirectories: (leftDir: string, rightDir: string) => Promise<FileDifference[]>;
  copyFile: (sourcePath: string, destPath: string, direction: string) => Promise<CopyFileResult>;
  readFile: (filePath: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

let leftDirectory: string | null = null;
let rightDirectory: string | null = null;
let differences: FileDifference[] = [];
let ignoredFiles = new Set<string>();

// DOM elements
const selectLeftBtn = document.getElementById('selectLeftBtn') as HTMLButtonElement;
const selectRightBtn = document.getElementById('selectRightBtn') as HTMLButtonElement;
const compareBtn = document.getElementById('compareBtn') as HTMLButtonElement;
const leftDirPath = document.getElementById('leftDirPath') as HTMLElement;
const rightDirPath = document.getElementById('rightDirPath') as HTMLElement;
const resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
const diffCount = document.getElementById('diffCount') as HTMLElement;
const compareModal = document.getElementById('compareModal') as HTMLElement;
const closeModal = document.getElementById('closeModal') as HTMLButtonElement;
const compareFileName = document.getElementById('compareFileName') as HTMLElement;
const leftFileContent = document.getElementById('leftFileContent') as HTMLElement;
const rightFileContent = document.getElementById('rightFileContent') as HTMLElement;

// Event listeners
selectLeftBtn.addEventListener('click', selectLeftDirectory);
selectRightBtn.addEventListener('click', selectRightDirectory);
compareBtn.addEventListener('click', compareDirectories);
closeModal.addEventListener('click', () => {
  compareModal.classList.remove('active');
});
compareModal.addEventListener('click', (e) => {
  if (e.target === compareModal) {
    compareModal.classList.remove('active');
  }
});

async function selectLeftDirectory(): Promise<void> {
  try {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) {
      leftDirectory = dir;
      leftDirPath.textContent = dir;
      
      // Enable compare button if both directories are set
      if (leftDirectory && rightDirectory) {
        compareBtn.disabled = false;
      }
    }
  } catch (error) {
    alert(`Error selecting directory: ${(error as Error).message}`);
  }
}

async function selectRightDirectory(): Promise<void> {
  try {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) {
      rightDirectory = dir;
      rightDirPath.textContent = dir;
      
      // Enable compare button if both directories are set
      if (leftDirectory && rightDirectory) {
        compareBtn.disabled = false;
      }
    }
  } catch (error) {
    alert(`Error selecting directory: ${(error as Error).message}`);
  }
}

async function compareDirectories(): Promise<void> {
  if (!leftDirectory || !rightDirectory) {
    alert('Please select both directories first');
    return;
  }

  compareBtn.disabled = true;
  compareBtn.textContent = 'Comparing...';
  resultsContainer.innerHTML = '<div class="empty-state"><p>Comparing directories...</p></div>';

  try {
    differences = await window.electronAPI.compareDirectories(
      leftDirectory,
      rightDirectory
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
  const viewBtn = item.querySelector('.view-file') as HTMLButtonElement | null;
  const copyLeftBtn = item.querySelector('.copy-left') as HTMLButtonElement | null;
  const copyRightBtn = item.querySelector('.copy-right') as HTMLButtonElement | null;
  const ignoreBtn = item.querySelector('.ignore') as HTMLButtonElement | null;

  if (viewBtn) {
    viewBtn.addEventListener('click', () => openCompareView(diff));
  }
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

  // Add view button for all types
  buttons.push('<button class="btn btn-action btn-view view-file">View</button>');

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

async function openCompareView(diff: FileDifference): Promise<void> {
  compareFileName.textContent = diff.path;
  
  // Show loading state and reset classes
  leftFileContent.innerHTML = '<div class="loading">Loading...</div>';
  rightFileContent.innerHTML = '<div class="loading">Loading...</div>';
  leftFileContent.classList.remove('binary', 'plain-text');
  rightFileContent.classList.remove('binary', 'plain-text');
  
  // Show modal
  compareModal.classList.add('active');
  
  // Load file contents
  const leftContent = diff.type !== 'right-only' ? await window.electronAPI.readFile(diff.leftPath) : null;
  const rightContent = diff.type !== 'left-only' ? await window.electronAPI.readFile(diff.rightPath) : null;
  
  // Handle missing files
  if (diff.type === 'right-only') {
    leftFileContent.innerHTML = '<div class="missing-file">File does not exist in left directory</div>';
    leftFileContent.classList.add('binary');
  } else if (leftContent === null) {
    leftFileContent.innerHTML = '<div class="missing-file">Binary file or unable to read</div>';
    leftFileContent.classList.add('binary');
  }
  
  if (diff.type === 'left-only') {
    rightFileContent.innerHTML = '<div class="missing-file">File does not exist in right directory</div>';
    rightFileContent.classList.add('binary');
  } else if (rightContent === null) {
    rightFileContent.innerHTML = '<div class="missing-file">Binary file or unable to read</div>';
    rightFileContent.classList.add('binary');
  }
  
  // If both files exist and are readable, show diff
  if (leftContent !== null && rightContent !== null && diff.type === 'modified') {
    displayDiff(leftContent, rightContent);
  } else {
    // Just display plain content for non-modified files
    if (leftContent !== null && diff.type !== 'right-only') {
      leftFileContent.textContent = normalizeLineEndings(leftContent);
      leftFileContent.classList.add('plain-text');
    }
    if (rightContent !== null && diff.type !== 'left-only') {
      rightFileContent.textContent = normalizeLineEndings(rightContent);
      rightFileContent.classList.add('plain-text');
    }
  }
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function displayDiff(leftContent: string, rightContent: string): void {
  // Normalize line endings before comparison
  const normalizedLeft = normalizeLineEndings(leftContent);
  const normalizedRight = normalizeLineEndings(rightContent);
  
  const diffResult = Diff.diffLines(normalizedLeft, normalizedRight);
  
  let leftHtml = '';
  let rightHtml = '';
  let leftLineNum = 1;
  let rightLineNum = 1;
  
  diffResult.forEach((part) => {
    const lines = part.value.split('\n');
    // Remove last empty line if exists
    if (lines[lines.length - 1] === '') {
      lines.pop();
    }
    
    lines.forEach((line, index) => {
      const isLastLine = index === lines.length - 1 && part === diffResult[diffResult.length - 1];
      const displayLine = line || ' '; // Show space for empty lines
      const escapedLine = escapeHtml(displayLine);
      
      if (part.added) {
        // Added in right only
        leftHtml += `<div class="diff-line diff-empty"><span class="line-num"></span><span class="line-content"></span></div>`;
        rightHtml += `<div class="diff-line diff-added"><span class="line-num">${rightLineNum}</span><span class="line-content">${escapedLine}</span></div>`;
        rightLineNum++;
      } else if (part.removed) {
        // Removed from left
        leftHtml += `<div class="diff-line diff-removed"><span class="line-num">${leftLineNum}</span><span class="line-content">${escapedLine}</span></div>`;
        rightHtml += `<div class="diff-line diff-empty"><span class="line-num"></span><span class="line-content"></span></div>`;
        leftLineNum++;
      } else {
        // Unchanged
        leftHtml += `<div class="diff-line"><span class="line-num">${leftLineNum}</span><span class="line-content">${escapedLine}</span></div>`;
        rightHtml += `<div class="diff-line"><span class="line-num">${rightLineNum}</span><span class="line-content">${escapedLine}</span></div>`;
        leftLineNum++;
        rightLineNum++;
      }
    });
  });
  
  leftFileContent.innerHTML = leftHtml;
  rightFileContent.innerHTML = rightHtml;
  leftFileContent.classList.remove('binary', 'plain-text');
  rightFileContent.classList.remove('binary', 'plain-text');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export an empty object to make this a module
export {};
