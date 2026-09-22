import {
  adminNotificationEmail,
  buildTransporter,
  isSmtpConfigured,
  smtpFrom,
} from './mailTransporter.js';

function fmtCdf(n) {
  if (n == null) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n))} CDF`;
}

function fmtUsd(n) {
  if (n == null) return '';
  return ` (${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))})`;
}

export { isSmtpConfigured };

export async function sendWelcomeEmail({ email, companyName }) {
  const transporter = buildTransporter();
  if (!transporter) {
    console.warn('[auth] SMTP non configuré — e-mail de bienvenue non envoyé');
    return { sent: false };
  }
  try {
    await transporter.sendMail({
      from: smtpFrom(),
      to: email,
      subject: '[AfeconCatalogue] Bienvenue sur votre espace client',
      text: [
        `Bonjour${companyName ? ` ${companyName}` : ''},`,
        '',
        'Votre compte AfeconCatalogue a bien été créé.',
        'Vous pouvez dès maintenant parcourir le catalogue, demander un devis et passer commande.',
        '',
        'À bientôt sur le catalogue.',
        '',
        '— L’équipe AfeconCatalogue',
      ].join('\n'),
    });
    return { sent: true };
  } catch (err) {
    console.error('[auth] E-mail de bienvenue échoué:', err.message);
    return { sent: false, error: err.message };
  }
}

export async function sendPasswordResetEmail({ email, resetUrl }) {
  const transporter = buildTransporter();
  if (!transporter) {
    throw Object.assign(new Error('Envoi e-mail non configuré (SMTP_HOST)'), { status: 503 });
  }
  await transporter.sendMail({
    from: smtpFrom(),
    to: email,
    subject: '[AfeconCatalogue] Réinitialisation de votre mot de passe',
    text: [
      'Vous avez demandé à réinitialiser votre mot de passe.',
      '',
      'Cliquez sur le lien ci-dessous (valable 1 heure) :',
      resetUrl,
      '',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
      '',
      '— AfeconCatalogue',
    ].join('\n'),
  });
  return { sent: true };
}

export async function sendContactInquiryEmail({ toEmail, replyTo, subject, text, attachments }) {
  const transporter = buildTransporter();
  if (!transporter) return { sent: false };
  await transporter.sendMail({
    from: smtpFrom(),
    to: toEmail,
    replyTo,
    subject,
    text,
    attachments: attachments?.length ? attachments : undefined,
  });
  return { sent: true };
}

export async function sendOrderConfirmationEmails({ order, quote, customerEmail }) {
  const transporter = buildTransporter();
  if (!transporter) {
    console.warn(`[order ${order.order_number}] SMTP non configuré — e-mails non envoyés`);
    return { clientSent: false, adminSent: false };
  }

  const snap = order.customer_snapshot || {};
  const totalLine = `${fmtCdf(order.total_cdf)}${fmtUsd(order.total_usd)}`;
  const adminTo = adminNotificationEmail();

  const common = [
    `Commande : ${order.order_number}`,
    quote?.quote_number ? `Devis d'origine : ${quote.quote_number}` : null,
    `Date : ${new Date(order.created_at).toLocaleString('fr-FR')}`,
    '',
    '--- Client ---',
    `Société : ${snap.company_name || '—'}`,
    customerEmail ? `E-mail : ${customerEmail}` : null,
    snap.phone ? `Téléphone : ${snap.phone}` : null,
    [snap.address_line, snap.city].filter(Boolean).join(', ') || null,
    '',
    '--- Montants HT ---',
    `Sous-total : ${fmtCdf(order.subtotal_cdf)}${fmtUsd(order.subtotal_usd)}`,
    `Livraison : ${fmtCdf(order.shipping_cdf)}${fmtUsd(order.shipping_usd)}`,
    `Total : ${totalLine}`,
  ]
    .filter(Boolean)
    .join('\n');

  let clientSent = false;
  let adminSent = false;

  if (customerEmail) {
    try {
      await transporter.sendMail({
        from: smtpFrom(),
        to: customerEmail,
        subject: `[AfeconCatalogue] Confirmation commande ${order.order_number}`,
        text: [
          'Votre commande a bien été enregistrée et payée.',
          '',
          common,
          '',
          'Nous vous recontacterons pour la suite de la préparation.',
        ].join('\n'),
      });
      clientSent = true;
    } catch (err) {
      console.error(`[order ${order.order_number}] E-mail client échoué:`, err.message);
    }
  }

  if (adminTo) {
    try {
      await transporter.sendMail({
        from: smtpFrom(),
        to: adminTo,
        replyTo: customerEmail || undefined,
        subject: `[AfeconCatalogue] Nouvelle commande ${order.order_number}`,
        text: ['Nouvelle commande client :', '', common].join('\n'),
      });
      adminSent = true;
    } catch (err) {
      console.error(`[order ${order.order_number}] E-mail admin échoué:`, err.message);
    }
  }

  return { clientSent, adminSent };
}
