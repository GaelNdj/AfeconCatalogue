/**
 * Génère l'affiche PDF AFECON Gestion (banderole / grand format).
 * Usage : npm run generate:affiche [banner|a0|a1]
 */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const LOGO = path.join(ROOT, 'assets', 'afecon-groupe-logo.png');
const OUT_DIR = path.join(ROOT, 'assets');

const MM = 72 / 25.4;

const BRAND = {
  navy: '#002D5A',
  navyDark: '#001428',
  green: '#75B628',
  greenLight: '#8FD43A',
  white: '#FFFFFF',
  whiteSoft: '#E8EEF5',
  grey: '#9BB0C8',
};

const FORMATS = {
  banner: { width: 850 * MM, height: 2000 * MM, name: 'affiche-banderole-850x2000mm.pdf' },
  a0: { width: 841 * MM, height: 1189 * MM, name: 'affiche-a0-portrait.pdf' },
  a1: { width: 594 * MM, height: 841 * MM, name: 'affiche-a1-portrait.pdf' },
};

function scaleFor(format, bannerBase) {
  return format.height / bannerBase;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lerpColor(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function drawBackground(doc, w, h) {
  const top = hexToRgb(BRAND.navy);
  const bottom = hexToRgb(BRAND.navyDark);
  const steps = 32;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const y = (h / steps) * i;
    const c = lerpColor(top, bottom, t);
    doc.rect(0, y, w, h / steps + 1).fill(`rgb(${c.r}, ${c.g}, ${c.b})`);
  }

  doc.save();
  doc.circle(w * 0.85, h * 0.12, h * 0.18).fillOpacity(0.08).fill(BRAND.green);
  doc.circle(w * 0.12, h * 0.55, h * 0.22).fillOpacity(0.06).fill(BRAND.greenLight);
  doc.circle(w * 0.9, h * 0.78, h * 0.14).fillOpacity(0.07).fill(BRAND.green);
  doc.restore();

  doc.save();
  doc.opacity(0.06);
  const wm = Math.min(w * 0.75, h * 0.35);
  doc.image(LOGO, (w - wm) / 2, h * 0.38, { fit: [wm, wm * 0.55], align: 'center', valign: 'center' });
  doc.opacity(1);
  doc.restore();
}

function drawGreenBar(doc, x, y, width, height) {
  doc.save();
  const grad = doc.linearGradient(x, y, x + width, y);
  grad.stop(0, BRAND.green).stop(1, BRAND.greenLight);
  doc.rect(x, y, width, height).fill(grad);
  doc.restore();
}

function drawBullet(doc, x, y, r) {
  doc.save();
  const grad = doc.linearGradient(x - r, y, x + r, y);
  grad.stop(0, BRAND.green).stop(1, BRAND.greenLight);
  doc.circle(x, y, r).fill(grad);
  doc.strokeColor(BRAND.white).lineWidth(r * 0.22).lineCap('round');
  doc.moveTo(x - r * 0.35, y).lineTo(x - r * 0.05, y + r * 0.32).lineTo(x + r * 0.42, y - r * 0.28).stroke();
  doc.restore();
}

function buildPoster(formatKey) {
  const format = FORMATS[formatKey] || FORMATS.banner;
  const s = scaleFor(format, FORMATS.banner.height);
  const w = format.width;
  const h = format.height;
  const margin = 70 * MM * Math.min(s, 1.15);
  const contentW = w - margin * 2;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(LOGO)) {
      reject(new Error(`Logo introuvable : ${LOGO}`));
      return;
    }

    const outPath = path.join(OUT_DIR, format.name);
    const stream = fs.createWriteStream(outPath);
    const doc = new PDFDocument({ size: [w, h], margin: 0, autoFirstPage: true });

    doc.pipe(stream);
    drawBackground(doc, w, h);

    let y = 90 * MM * s;

    const logoW = contentW * 0.55;
    doc.image(LOGO, (w - logoW) / 2, y, { fit: [logoW, logoW * 0.42] });
    y += logoW * 0.42 + 55 * MM * s;

    drawGreenBar(doc, margin, y, contentW * 0.22, 5 * s);
    y += 28 * MM * s;

    const headlineSize = 52 * s;
    doc.font('Helvetica-Bold').fontSize(headlineSize).fillColor(BRAND.white);
    doc.text('Parce que la construction commence', margin, y, { width: contentW, align: 'center' });
    y += headlineSize * 1.15;
    doc.text('par une bonne', margin, y, { width: contentW, align: 'center' });
    y += headlineSize * 1.1;
    doc.fillColor(BRAND.greenLight).text('Gestion.', margin, y, { width: contentW, align: 'center' });
    doc.fillColor(BRAND.white);
    y += headlineSize * 1.5;

    const features = [
      'Centraliser les données',
      'Planifier la maintenance',
      'Améliorer la sécurité',
      'Gérer les priorités',
    ];

    const cardGap = 18 * MM * s;
    const cardH = 95 * MM * s;
    const cardW = (contentW - cardGap) / 2;
    const cardStartY = y;

    features.forEach((label, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = margin + col * (cardW + cardGap);
      const cy = cardStartY + row * (cardH + cardGap);

      doc.save();
      doc.roundedRect(cx, cy, cardW, cardH, 14 * s).fillOpacity(0.12).fill(BRAND.white);
      doc.roundedRect(cx, cy, cardW, cardH, 14 * s).lineWidth(2 * s).strokeOpacity(0.35).stroke(BRAND.green);
      doc.restore();

      drawBullet(doc, cx + 36 * MM * s, cy + cardH * 0.5, 14 * MM * s);
      doc.font('Helvetica-Bold').fontSize(22 * s).fillColor(BRAND.white);
      doc.text(label, cx + 58 * MM * s, cy + cardH * 0.32, { width: cardW - 68 * MM * s });
    });

    y = cardStartY + 2 * (cardH + cardGap) + 60 * MM * s;

    doc.save();
    doc.roundedRect(margin, y, contentW, 200 * MM * s, 18 * s).fillOpacity(0.14).fill(BRAND.green);
    doc.restore();

    const taglineSize = 44 * s;
    doc.font('Helvetica-Bold').fontSize(taglineSize).fillColor(BRAND.white);
    doc.text("L'outil qui sécurise vos projets.", margin + 30 * MM * s, y + 52 * MM * s, {
      width: contentW - 60 * MM * s,
      align: 'center',
    });

    y += 200 * MM * s + 50 * MM * s;

    const subSize = 34 * s;
    doc.font('Helvetica-Bold').fontSize(subSize).fillColor(BRAND.greenLight);
    doc.text('Fini les pertes d\u2019informations.', margin, y, { width: contentW, align: 'center' });
    y += subSize * 1.8;

    doc.font('Helvetica').fontSize(20 * s).fillColor(BRAND.grey);
    const pills = [
      'Historique des interventions',
      'Suivi en temps réel',
      'Transparence des opérations',
    ];
    doc.text(pills.join('   \u2022   '), margin + 20 * MM * s, y, {
      width: contentW - 40 * MM * s,
      align: 'center',
      lineGap: 8 * s,
    });

    y = h - margin - 80 * MM * s;
    drawGreenBar(doc, margin + contentW * 0.3, y, contentW * 0.4, 4 * s);
    y += 18 * MM * s;

    doc.font('Helvetica').fontSize(16 * s).fillColor(BRAND.grey);
    doc.text('AFECON GROUPE  \u2022  FACILITY MANAGEMENT & ENGINEERING', margin, y, {
      width: contentW,
      align: 'center',
    });

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
  });
}

async function main() {
  const arg = process.argv[2] || 'all';
  const keys = arg === 'all' ? Object.keys(FORMATS) : [arg];
  for (const key of keys) {
    const out = await buildPoster(key);
    console.log(`Affiche générée : ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
