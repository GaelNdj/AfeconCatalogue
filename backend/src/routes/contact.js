import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { sendContactInquiryEmail } from '../services/mail.js';
import { isSmtpConfigured } from '../services/mailTransporter.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contactDir = path.resolve(__dirname, '../../private/contact-inquiries');
fs.mkdirSync(contactDir, { recursive: true });

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: contactDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
      cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error('Photos acceptées : JPG, PNG, WEBP ou HEIC.'));
    }
    cb(null, true);
  },
});

function clean(s, max = 500) {
  return String(s || '')
    .trim()
    .slice(0, max);
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function discardUploads(files) {
  for (const file of files || []) {
    fs.unlink(file.path, () => {});
  }
}

function uploadErrorMessage(err) {
  if (err?.code === 'LIMIT_FILE_SIZE') return 'Chaque photo doit faire moins de 4 Mo.';
  if (err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return `Maximum ${MAX_PHOTOS} photos.`;
  }
  return err?.message || 'Envoi des photos impossible.';
}

router.post('/', (req, res, next) => {
  photoUpload.array('photos', MAX_PHOTOS)(req, res, (err) => {
    if (err) return res.status(400).json({ error: uploadErrorMessage(err) });
    next();
  });
}, async (req, res, next) => {
  const files = req.files || [];
  try {
    const body = req.body || {};
    const name = clean(body.name, 200);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 50);
    const company = clean(body.company, 200);
    const partDescription = clean(body.part_description, 2000);
    const reference = clean(body.reference, 200);
    const brand = clean(body.brand, 200);
    const dimensions = clean(body.dimensions, 200);
    const message = clean(body.message, 2000);
    const searchedFor = clean(body.searched_for, 500);

    if (!name) {
      discardUploads(files);
      return res.status(400).json({ error: 'Le nom est obligatoire.' });
    }
    if (!email || !isEmail(email)) {
      discardUploads(files);
      return res.status(400).json({ error: 'Une adresse e-mail valide est obligatoire.' });
    }
    if (!partDescription) {
      discardUploads(files);
      return res.status(400).json({ error: 'Décrivez la pièce recherchée.' });
    }

    const toEmail = process.env.CONTACT_TO_EMAIL;
    if (!toEmail) {
      discardUploads(files);
      return res.status(503).json({
        error: 'Contact non configuré. Définissez CONTACT_TO_EMAIL dans backend/.env',
      });
    }

    const photoPaths = files.map((f) => f.filename);

    const { rows } = await pool.query(
      `INSERT INTO contact_inquiries
        (name, email, phone, company, part_description, reference, brand, dimensions, message, searched_for, photo_paths)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, created_at`,
      [
        name,
        email,
        phone || null,
        company || null,
        partDescription,
        reference || null,
        brand || null,
        dimensions || null,
        message || null,
        searchedFor || null,
        photoPaths.length ? photoPaths.join(',') : null,
      ]
    );

    const inquiryId = rows[0].id;
    const subject = `[AfeconCatalogue] Demande pièce introuvable — ${name}`;
    const text = [
      'Nouvelle demande depuis AfeconCatalogue',
      '',
      `Réf. demande : #${inquiryId}`,
      `Date : ${new Date(rows[0].created_at).toLocaleString('fr-FR')}`,
      '',
      '--- Contact ---',
      `Nom : ${name}`,
      company ? `Société : ${company}` : null,
      `E-mail : ${email}`,
      phone ? `Téléphone : ${phone}` : null,
      '',
      '--- Pièce recherchée ---',
      `Description : ${partDescription}`,
      reference ? `Référence / code connu : ${reference}` : null,
      brand ? `Marque : ${brand}` : null,
      dimensions ? `Dimensions : ${dimensions}` : null,
      searchedFor ? `Recherche effectuée : « ${searchedFor} »` : null,
      message ? `\nMessage :\n${message}` : null,
      photoPaths.length ? `\nPhotos jointes : ${photoPaths.length}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const reply =
      'Votre demande a bien été envoyée. Nous vous répondons sous 4 h ouvrées.';

    if (!isSmtpConfigured()) {
      console.warn(
        `[contact #${inquiryId}] Enregistré en base — SMTP non configuré (SMTP_HOST manquant)`
      );
      return res.json({
        ok: true,
        id: inquiryId,
        emailSent: false,
        message:
          'Demande enregistrée. Configurez SMTP_HOST pour l’envoi automatique par e-mail.',
      });
    }

    await sendContactInquiryEmail({
      toEmail,
      replyTo: email,
      subject,
      text,
      attachments: files.map((f) => ({
        filename: f.originalname || f.filename,
        path: f.path,
        contentType: f.mimetype,
      })),
    });

    res.json({
      ok: true,
      id: inquiryId,
      emailSent: true,
      message: reply,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
