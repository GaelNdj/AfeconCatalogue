import PDFDocument from 'pdfkit';

function fmtCdf(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n))} CDF`;
}

function fmtUsd(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

function fmtDateFr(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('fr-FR');
}

function lineLabel(line) {
  const parts = [line.product_name];
  if (line.variant_label) parts.push(line.variant_label);
  return parts.filter(Boolean).join(' — ');
}

function lineRef(line) {
  return line.internal_code || line.ref_pro || line.sku_code || '—';
}

function renderDocument({ doc, title, docNumber, customer, meta, lines, totals }) {
  const margin = 50;
  const pageWidth = doc.page.width - margin * 2;

  doc.fontSize(20).font('Helvetica-Bold').text('AfeconCatalogue', margin, margin);
  doc.fontSize(11).font('Helvetica').fillColor('#555555');
  doc.text(title, margin, margin + 26);
  doc.fillColor('#000000');

  doc.fontSize(10).font('Helvetica-Bold').text(docNumber, margin, margin + 44);
  doc.font('Helvetica').fontSize(9).fillColor('#444444');
  let metaY = margin + 60;
  for (const row of meta) {
    doc.text(row, margin, metaY);
    metaY += 14;
  }
  doc.fillColor('#000000');

  const clientX = margin + pageWidth * 0.55;
  doc.font('Helvetica-Bold').fontSize(10).text('Client', clientX, margin + 44);
  doc.font('Helvetica').fontSize(9).fillColor('#444444');
  let clientY = margin + 60;
  for (const row of customer) {
    doc.text(row, clientX, clientY, { width: pageWidth * 0.45 });
    clientY += 14;
  }
  doc.fillColor('#000000');

  const tableTop = Math.max(metaY, clientY) + 24;
  const cols = {
    designation: margin,
    ref: margin + pageWidth * 0.38,
    qty: margin + pageWidth * 0.52,
    totalCdf: margin + pageWidth * 0.6,
    totalUsd: margin + pageWidth * 0.78,
  };

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#666666');
  doc.text('DÉSIGNATION', cols.designation, tableTop);
  doc.text('RÉF.', cols.ref, tableTop);
  doc.text('QTÉ', cols.qty, tableTop);
  doc.text('TOTAL CDF', cols.totalCdf, tableTop, { width: pageWidth * 0.16, align: 'right' });
  doc.text('TOTAL USD', cols.totalUsd, tableTop, { width: pageWidth * 0.2, align: 'right' });
  doc.fillColor('#000000');

  let y = tableTop + 18;
  doc.moveTo(margin, y - 6).lineTo(margin + pageWidth, y - 6).strokeColor('#cccccc').stroke();

  for (const line of lines) {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = margin;
    }

    const rowHeight = line.price_on_quote ? 28 : 34;
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    doc.text(lineLabel(line), cols.designation, y, { width: pageWidth * 0.35 });
    doc.text(lineRef(line), cols.ref, y, { width: pageWidth * 0.12 });
    doc.text(String(line.qty), cols.qty, y);

    if (line.price_on_quote) {
      doc.fillColor('#666666').text('Sur devis', cols.totalCdf, y, {
        width: pageWidth * 0.36,
        align: 'right',
      });
      doc.fillColor('#000000');
    } else {
      doc.text(fmtCdf(line.line_total_cdf), cols.totalCdf, y, {
        width: pageWidth * 0.16,
        align: 'right',
      });
      doc.fontSize(8).fillColor('#666666').text(
        fmtUsd(line.line_total_usd ?? (line.unit_price_usd != null ? line.unit_price_usd * line.qty : null)),
        cols.totalUsd,
        y,
        { width: pageWidth * 0.2, align: 'right' }
      );
      doc.fontSize(9).fillColor('#000000');
    }

    y += rowHeight;
    doc.moveTo(margin, y - 4).lineTo(margin + pageWidth, y - 4).strokeColor('#eeeeee').stroke();
  }

  const totalsTop = y + 16;
  const labelX = margin + pageWidth * 0.45;
  const cdfX = cols.totalCdf;
  const usdX = cols.totalUsd;

  const totalRows = [
    ['Sous-total HT', totals.subtotal_cdf, totals.subtotal_usd],
    ['Livraison HT', totals.shipping_cdf, totals.shipping_usd],
    ['Total HT', totals.total_cdf, totals.total_usd],
  ];

  let ty = totalsTop;
  for (const [label, cdf, usd] of totalRows) {
    const isTotal = label === 'Total HT';
    doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(isTotal ? 10 : 9);
    doc.text(label, labelX, ty, { width: pageWidth * 0.12, align: 'right' });
    doc.text(fmtCdf(cdf), cdfX, ty, { width: pageWidth * 0.16, align: 'right' });
    doc.fontSize(isTotal ? 9 : 8).fillColor(isTotal ? '#000000' : '#666666');
    doc.text(fmtUsd(usd), usdX, ty, { width: pageWidth * 0.2, align: 'right' });
    doc.fillColor('#000000');
    ty += isTotal ? 20 : 16;
  }

  if (totals.shipping_rule_name) {
    doc.font('Helvetica').fontSize(8).fillColor('#888888').text(
      `Livraison : ${totals.shipping_rule_name}`,
      margin,
      ty + 8
    );
  }

  doc.font('Helvetica').fontSize(8).fillColor('#888888').text(
    'Montants HT — CDF principal, équivalent USD indicatif.',
    margin,
    doc.page.height - margin
  );
}

function buildPdfBuffer(renderFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderFn(doc);
    doc.end();
  });
}

export function buildQuotePdf(quote, lines) {
  const snap = quote.customer_snapshot || {};
  const customer = [
    snap.company_name || '—',
    snap.email,
    snap.phone,
    [snap.address_line, snap.city].filter(Boolean).join(', ') || null,
  ].filter(Boolean);

  const meta = [
    `Date : ${fmtDateFr(quote.created_at)}`,
    quote.valid_until ? `Valable jusqu'au ${fmtDateFr(quote.valid_until)}` : null,
    `Statut : ${quote.status === 'converted' ? 'Commandé' : 'En attente'}`,
  ].filter(Boolean);

  return buildPdfBuffer((doc) =>
    renderDocument({
      doc,
      title: 'Devis',
      docNumber: quote.quote_number,
      customer,
      meta,
      lines,
      totals: {
        subtotal_cdf: quote.subtotal_cdf,
        subtotal_usd: quote.subtotal_usd,
        shipping_cdf: quote.shipping_cdf,
        shipping_usd: quote.shipping_usd,
        total_cdf: quote.total_cdf,
        total_usd: quote.total_usd,
        shipping_rule_name: quote.shipping_rule_name,
      },
    })
  );
}

export function buildOrderPdf(order, lines, quoteNumber) {
  const snap = order.customer_snapshot || {};
  const customer = [
    snap.company_name || '—',
    snap.email,
    snap.phone,
    [snap.address_line, snap.city].filter(Boolean).join(', ') || null,
  ].filter(Boolean);

  const statusLabels = {
    received: 'Reçue',
    preparing: 'En préparation',
    shipped: 'Expédiée',
  };

  const meta = [
    `Date : ${fmtDateFr(order.created_at)}`,
    quoteNumber ? `Devis : ${quoteNumber}` : null,
    `Statut : ${statusLabels[order.status] || order.status}`,
  ].filter(Boolean);

  return buildPdfBuffer((doc) =>
    renderDocument({
      doc,
      title: 'Bon de commande',
      docNumber: order.order_number,
      customer,
      meta,
      lines,
      totals: {
        subtotal_cdf: order.subtotal_cdf,
        subtotal_usd: order.subtotal_usd,
        shipping_cdf: order.shipping_cdf,
        shipping_usd: order.shipping_usd,
        total_cdf: order.total_cdf,
        total_usd: order.total_usd,
        shipping_rule_name: order.shipping_rule_name,
      },
    })
  );
}
