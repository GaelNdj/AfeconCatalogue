#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'frontend/node_modules/.bin/vite');
const vitePkg = path.join(root, 'frontend/node_modules/vite/package.json');

const payload = {
  sessionId: '913862',
  runId: process.env.DEBUG_BUILD_RUN || 'pre-fix',
  hypothesisId: 'A',
  location: 'scripts/log-frontend-build.js',
  message: 'frontend build toolchain',
  data: {
    nodeEnv: process.env.NODE_ENV || '',
    npmConfigProduction: process.env.NPM_CONFIG_PRODUCTION || '',
    viteBinExists: fs.existsSync(viteBin),
    vitePkgExists: fs.existsSync(vitePkg),
    npmScript: process.env.npm_lifecycle_event || '',
  },
  timestamp: Date.now(),
};

// #region agent log
fetch('http://127.0.0.1:7581/ingest/20d23877-a71f-467f-86e2-87ccf471af2f', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '913862' },
  body: JSON.stringify(payload),
}).catch(() => {});
try {
  fs.appendFileSync(
    path.join(root, '.cursor/debug-913862.log'),
    `${JSON.stringify(payload)}\n`
  );
} catch {
  /* ignore if .cursor is not writable in the image */
}
// #endregion

console.log(
  `[build] NODE_ENV=${payload.data.nodeEnv || '(empty)'} vite=${
    payload.data.viteBinExists || payload.data.vitePkgExists ? 'ok' : 'missing'
  }`
);
