/**
 * Flyer A5 CFP — remplace « Afrique » par « DRC » et met à jour l'adresse.
 * Source : ~/Downloads/Flyer A5 CFP AFRICA_V2.pdf
 *
 * Coordonnées mesurées sur flyer-a5-source-hq.png (2428×3307, rendu PDF ×5) :
 *   Adresse  : x 1234–2105, y 2859–2884  (ligne au-dessus du WhatsApp, même bord droit)
 *   Afrique  : x 508–714,   y 2895–2945  (sous « Concept FP »)
 */
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
const SRC_PDF = path.join(process.env.HOME || '', 'Downloads', 'Flyer A5 CFP AFRICA_V2.pdf');
const SRC_HQ = path.join(ASSETS, 'flyer-a5-source-hq.png');
const OUT_PDF = path.join(ASSETS, 'Flyer-A5-CFP-DRC.pdf');
const OUT_JPG = path.join(ASSETS, 'Flyer-A5-CFP-DRC.jpg');
const OUT_PDF_DL = path.join(process.env.HOME || '', 'Downloads', 'Flyer A5 CFP DRC.pdf');
const OUT_JPG_DL = path.join(process.env.HOME || '', 'Downloads', 'Flyer A5 CFP DRC.jpg');

const FOOTER_BG = '#085866';
const TITLE_BADGE = '#26b1d4';
const DRC_COLOR = '#08a4c9';
const ADDRESS_COLOR = '#ffffff';
const FONT = 'Avenir Next, Avenir, Helvetica Neue, Helvetica, Arial, sans-serif';
const NEW_ADDR_L1 = 'N° 52, Avenue Tabora - Réf. Agence Sonas';
const NEW_ADDR_L2 = 'Kintambo Magasin, Kinshasa - RD Congo';
const NEW_WHATSAPP_NUM = '+243 898 721 724';
const NEW_TITLE = 'BUREAU D’ÉTUDE ET D’EXÉCUTION';
const NEW_SUB_L1 = 'spécialisé dans l’exécution et la conception de plans de plomberie,';
const NEW_SUB_L2 = 'ventilation et climatisation pour les villas et les bâtiments';

// Masques un peu plus grands que le texte pour couvrir l'anti-aliasing.
const CONTACT_BAND = { left: 880, top: 2844, width: 1240, height: 160 };
const AFRIQUE_MASK = { left: 500, top: 2888, width: 230, height: 64 };
const TITLE_BAND = { left: 180, top: 2036, width: 2068, height: 100 };
const SUBTITLE_BAND = { left: 180, top: 2185, width: 2068, height: 135 };

// Position du texte dans le fichier source (pas dans le masque).
const CONTACT_RIGHT_X = 2105;
const DRC_LEFT_X = 518;
const DRC_BASELINE_Y = 2936;

async function ensureSourceHq() {
  if (!fs.existsSync(SRC_PDF)) {
    throw new Error(`PDF source introuvable : ${SRC_PDF}`);
  }
  await execFileAsync('python3', [
    '-c',
    `import pymupdf; doc=pymupdf.open(${JSON.stringify(SRC_PDF)}); p=doc[0]; p.get_pixmap(matrix=pymupdf.Matrix(5,5), alpha=False).save(${JSON.stringify(SRC_HQ)})`,
  ]);
}

async function solidMask({ width, height }) {
  return sharp({
    create: { width, height, channels: 3, background: FOOTER_BG },
  })
    .png()
    .toBuffer();
}

function contactSvg() {
  const { width, height } = CONTACT_BAND;
  const x = CONTACT_RIGHT_X - CONTACT_BAND.left;
  return Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${FOOTER_BG}"/>
  <text x="${x}" y="36" text-anchor="end"
        font-family="${FONT}" font-size="28" fill="${ADDRESS_COLOR}">
    <tspan font-weight="700">Adresse : </tspan>
    <tspan font-weight="400">${NEW_ADDR_L1}</tspan>
  </text>
  <text x="${x}" y="72" text-anchor="end"
        font-family="${FONT}" font-size="28" font-weight="400"
        fill="${ADDRESS_COLOR}">${NEW_ADDR_L2}</text>
  <text x="${x}" y="120" text-anchor="end"
        font-family="${FONT}" font-size="30" fill="${ADDRESS_COLOR}">
    <tspan font-weight="700">WhatsApp </tspan>
    <tspan font-weight="400">${NEW_WHATSAPP_NUM} - </tspan>
    <tspan font-weight="700">contact@concept-fp.com</tspan>
  </text>
</svg>
`);
}

function titleSvg() {
  const { width, height } = TITLE_BAND;
  const barH = 88;
  const barW = 1320;
  const barX = Math.round((width - barW) / 2);
  const barY = 6;
  const textY = 70;
  return Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${FOOTER_BG}"/>
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" fill="${TITLE_BADGE}"/>
  <text x="${Math.round(width / 2)}" y="${textY}" text-anchor="middle"
        font-family="${FONT}" font-size="64" font-weight="700"
        fill="#ffffff">${NEW_TITLE}</text>
</svg>
`);
}

function subtitleSvg() {
  const { width, height } = SUBTITLE_BAND;
  return Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${FOOTER_BG}"/>
  <text x="${Math.round(width / 2)}" y="52" text-anchor="middle"
        font-family="${FONT}" font-size="48" font-weight="400"
        fill="#ffffff">${NEW_SUB_L1}</text>
  <text x="${Math.round(width / 2)}" y="118" text-anchor="middle"
        font-family="${FONT}" font-size="48" font-weight="400"
        fill="#ffffff">${NEW_SUB_L2}</text>
</svg>
`);
}
function drcSvg() {
  const { width, height } = AFRIQUE_MASK;
  const x = DRC_LEFT_X - AFRIQUE_MASK.left;
  const y = DRC_BASELINE_Y - AFRIQUE_MASK.top;
  return Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${x}" y="${y}"
        font-family="${FONT}"
        font-size="56"
        font-weight="300"
        fill="${DRC_COLOR}">DRC</text>
</svg>
`);
}

async function buildFlyerImage() {
  await ensureSourceHq();

  const [afMask] = await Promise.all([solidMask(AFRIQUE_MASK)]);

  return sharp(SRC_HQ)
    .composite([
      { input: titleSvg(), left: TITLE_BAND.left, top: TITLE_BAND.top },
      { input: subtitleSvg(), left: SUBTITLE_BAND.left, top: SUBTITLE_BAND.top },
      { input: afMask, left: AFRIQUE_MASK.left, top: AFRIQUE_MASK.top },
      { input: contactSvg(), left: CONTACT_BAND.left, top: CONTACT_BAND.top },
      { input: drcSvg(), left: AFRIQUE_MASK.left, top: AFRIQUE_MASK.top },
    ])
    .png()
    .toBuffer();
}

async function imageToPdf(pngBuffer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.image(pngBuffer, 0, 0, { width: doc.page.width, height: doc.page.height });
    doc.end();
  });
}

const pngBuffer = await buildFlyerImage();
const pdfBuffer = await imageToPdf(pngBuffer);

await sharp(pngBuffer).jpeg({ quality: 95, mozjpeg: true }).toFile(OUT_JPG);
fs.writeFileSync(OUT_PDF, pdfBuffer);

try {
  fs.copyFileSync(OUT_PDF, OUT_PDF_DL);
  fs.copyFileSync(OUT_JPG, OUT_JPG_DL);
  console.log(`Copie : ${OUT_PDF_DL}`);
  console.log(`Copie : ${OUT_JPG_DL}`);
} catch {
  console.warn('Copie Downloads ignorée');
}

const meta = await sharp(OUT_JPG).metadata();
console.log(`JPEG : ${OUT_JPG} (${meta.width}×${meta.height} px)`);
console.log(`PDF  : ${OUT_PDF}`);
