import nodemailer from 'nodemailer';

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

function fmtCdf(n) {
  if (n == null) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n))} CDF`;
}

function fmtUsd(n) {
  if (n == null) return '';
  return ` (${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n))})`;
}

function ordersToEmail() {
  return process.env.ORDERS_TO_EMAIL || process.env.CONTACT_TO_EMAIL || null;
}

function smtpFrom() {
  const to = ordersToEmail();
  return process.env.SMTP_FROM || `"AfeconCatalogue" <${process.env.SMTP_USER || to}>`;
}

export async function sendOrderConfirmationEmails({ order, quote, customerEmail }) {
  const transporter = buildTransporter();
  if (!transporter) {
    console.warn(`[order ${order.order_number}] SMTP non configuré — e-mails non envoyés`);
    return { clientSent: false, adminSent: false };
  }

  const snap = order.customer_snapshot || {};
  const totalLine = `${fmtCdf(order.total_cdf)}${fmtUsd(order.total_usd)}`;
  const adminTo = ordersToEmail();

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
          'Votre commande a bien été enregistrée.',
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
