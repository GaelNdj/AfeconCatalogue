/**
 * Teste la configuration SMTP (envoi vers CONTACT_TO_EMAIL ou ORDERS_TO_EMAIL).
 * Usage : npm run test:smtp
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTransporter, isSmtpConfigured, smtpFrom } from '../src/services/mailTransporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const to =
  process.env.CONTACT_TO_EMAIL?.trim() ||
  process.env.ORDERS_TO_EMAIL?.trim() ||
  process.env.SMTP_USER?.trim();

if (!isSmtpConfigured()) {
  console.error('SMTP_HOST manquant dans backend/.env');
  process.exit(1);
}
if (!to) {
  console.error('Définissez CONTACT_TO_EMAIL ou ORDERS_TO_EMAIL (ou SMTP_USER)');
  process.exit(1);
}
if (!process.env.SMTP_PASS?.trim()) {
  console.error('SMTP_PASS manquant — pour Gmail, utilisez un mot de passe d’application');
  process.exit(1);
}

const transporter = buildTransporter();
try {
  const info = await transporter.sendMail({
    from: smtpFrom(),
    to,
    subject: '[AfeconCatalogue] Test SMTP',
    text: 'Si vous recevez ce message, la configuration SMTP fonctionne.',
  });
  console.log('OK — message envoyé à', to);
  console.log('Message-ID:', info.messageId);
} catch (err) {
  console.error('Échec SMTP:', err.message);
  process.exit(1);
}
