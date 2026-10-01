#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteOk = fs.existsSync(path.join(root, 'frontend/node_modules/vite/package.json'));
const expressOk = fs.existsSync(path.join(root, 'backend/node_modules/express/package.json'));

console.log(`[build] vite=${viteOk ? 'ok' : 'missing'} express=${expressOk ? 'ok' : 'missing'}`);
if (!expressOk) {
  console.error('[build] backend/node_modules/express manquant — npm run install:backend a échoué');
  process.exit(1);
}
if (!viteOk) {
  console.error('[build] frontend/node_modules/vite manquant — npm run install:frontend a échoué');
  process.exit(1);
}
