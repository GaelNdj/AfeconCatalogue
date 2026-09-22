import nodemailer from 'nodemailer';

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim());
}

export function buildTransporter() {
  const host = process.env.SMTP_HOST?.trim();
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

export function smtpFrom() {
  const fallback = process.env.SMTP_USER || process.env.CONTACT_TO_EMAIL;
  return process.env.SMTP_FROM || `"AfeconCatalogue" <${fallback}>`;
}

export function adminNotificationEmail() {
  return process.env.ORDERS_TO_EMAIL || process.env.CONTACT_TO_EMAIL || null;
}
