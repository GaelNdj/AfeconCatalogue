import express from 'express';
import nodemailer from 'nodemailer';
import { pool } from '../db.js';

const router = express.Router();

function clean(s, max = 500) {
  return String(s || '')
    .trim()
    .slice(0, max);
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

router.post('/', async (req, res, next) => {
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
      return res.status(400).json({ error: 'Le nom est obligatoire.' });
    }
    if (!email || !isEmail(email)) {
      return res.status(400).json({ error: 'Une adresse e-mail valide est obligatoire.' });
    }
    if (!partDescription) {
      return res.status(400).json({ error: 'Décrivez la pièce recherchée.' });
    }

    const toEmail = process.env.CONTACT_TO_EMAIL;
    if (!toEmail) {
      return res.status(503).json({
        error:
          'Contact non configuré. Définissez CONTACT_TO_EMAIL dans backend/.env',
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO contact_inquiries
        (name, email, phone, company, part_description, reference, brand, dimensions, message, searched_for)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
    ]
      .filter(Boolean)
      .join('\n');

    const transporter = buildTransporter();
    if (!transporter) {
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

    const from =
      process.env.SMTP_FROM || `"AfeconCatalogue" <${process.env.SMTP_USER || toEmail}>`;

    await transporter.sendMail({
      from,
      to: toEmail,
      replyTo: email,
      subject,
      text,
    });

    res.json({
      ok: true,
      id: inquiryId,
      emailSent: true,
      message: 'Votre demande a bien été envoyée. Nous vous recontacterons rapidement.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
