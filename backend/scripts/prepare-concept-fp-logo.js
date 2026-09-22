/**
 * Remplace uniquement « Afrique » par « DRC » (même bleu clair, même emplacement).
 * Usage : npm run prepare:logo:drc
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'assets', 'logo-concept-fp-source.png');
const OUT_PNG = path.join(ROOT, 'assets', 'logo-concept-fp-drc.png');
const OUT_JPG = path.join(ROOT, 'assets', 'logo-concept-fp-drc.jpg');

const BG = '#f7f7f7';
const TEXT_COLOR = '#6bc8e6';

// Mot « Afrique » — zone mesurée sur le fichier source 792×612.
const AFRIQUE = { left: 345, top: 314, width: 230, height: 37 };

const mask = Buffer.from(`
<svg width="${AFRIQUE.width}" height="${AFRIQUE.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG}"/>
</svg>
`);

const drc = Buffer.from(`
<svg width="${AFRIQUE.width}" height="${AFRIQUE.height}" xmlns="http://www.w3.org/2000/svg">
  <text x="0"
        y="33"
        font-family="Helvetica, Arial, sans-serif"
        font-size="44"
        font-weight="300"
        fill="${TEXT_COLOR}">DRC</text>
</svg>
`);

const composed = await sharp(SRC)
  .composite([
    { input: mask, left: AFRIQUE.left, top: AFRIQUE.top },
    { input: drc, left: AFRIQUE.left, top: AFRIQUE.top },
  ])
  .png()
  .toBuffer();

await sharp(composed).png().toFile(OUT_PNG);
await sharp(composed).jpeg({ quality: 95, mozjpeg: true }).toFile(OUT_JPG);

console.log(`Logo DRC : ${OUT_PNG}`);
console.log(`Logo DRC : ${OUT_JPG}`);
