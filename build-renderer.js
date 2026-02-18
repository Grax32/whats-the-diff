const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/renderer.ts'],
  bundle: true,
  outfile: 'dist/renderer.js',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  format: 'esm'
}).catch(() => process.exit(1));
