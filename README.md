# whats-the-diff

Comparison tool intended to keep base files in sync when applications use the same configuration.

## Overview

What's the Diff is an Electron-based desktop application that compares two directories and displays the differences in a user-friendly interface. It allows you to synchronize files between directories by copying files in either direction or ignoring specific changes.

## Features

- **Config File Support**: Load a JSON config file to specify directories to compare
- **Visual Diff Display**: See all differences with clear indicators for:
  - Modified files (files that exist in both directories but differ)
  - Left-only files (files only in left directory)
  - Right-only files (files only in right directory)
- **Sync Controls**: For each difference, you can:
  - Copy from left to right (L→R)
  - Copy from right to left (R→L)
  - Ignore the change
- **File Information**: View file sizes and modification times for easy comparison

## Technology Stack

- **TypeScript**: Type-safe development
- **Electron**: Desktop application framework
- **npm**: Package management and build system

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Building

The project uses TypeScript and requires a build step to compile the source code to JavaScript:

```bash
npm run build
```

This will:
- Compile TypeScript files from `src/` to JavaScript in `dist/`
- Copy required assets (HTML, CSS, config) to `dist/`
- Generate source maps for debugging

## Usage

1. Build and start the application:
   ```bash
   npm start
   ```

2. Create a config file (see `config.example.json`):
   ```json
   {
     "leftDirectory": "/path/to/left/directory",
     "rightDirectory": "/path/to/right/directory"
   }
   ```

3. Click "Load Config File" and select your config file

4. Click "Compare Directories" to see the differences

5. Use the action buttons for each difference:
   - **Copy L→R**: Copy the file from left directory to right directory
   - **Copy R→L**: Copy the file from right directory to left directory
   - **Ignore**: Hide this difference from the count (visual only)

## Development

For development, you can use:

```bash
npm run dev
```

This will build the project and start the Electron application.

## Project Structure

```
whats-the-diff/
├── src/              # TypeScript source files
│   ├── main.ts       # Main Electron process
│   ├── preload.ts    # Preload script for IPC
│   └── renderer.ts   # Renderer process (UI logic)
├── dist/             # Compiled JavaScript (generated)
├── index.html        # Application UI
├── styles.css        # Application styles
├── tsconfig.json     # TypeScript configuration
└── package.json      # npm configuration
```

## Config File Format

The config file is a simple JSON file with two required properties:

```json
{
  "leftDirectory": "/absolute/path/to/left/directory",
  "rightDirectory": "/absolute/path/to/right/directory"
}
```

Both paths should be absolute paths to the directories you want to compare.

## License

MIT
