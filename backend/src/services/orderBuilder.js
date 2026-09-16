import { query } from '../db.js';

export async function nextOrderNumber() {
  const year = new Date().getFullYear();
  const prefix = `CMD-${year}-`;
  const r = await query(
    `SELECT order_number FROM orders
     WHERE order_number LIKE $1
     ORDER BY order_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let seq = 1;
  if (r.rows[0]) {
    const last = r.rows[0].order_number;
    const n = parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

export async function createOrderFromQuote(quoteId, userId, db) {
  const q = await db.query(`SELECT * FROM quotes WHERE id = $1 AND user_id = $2`, [
    quoteId,
    userId,
  ]);
  const quote = q.rows[0];
  if (!quote) {
    throw Object.assign(new Error('Devis introuvable'), { status: 404 });
  }
  if (quote.status === 'converted') {
    throw Object.assign(new Error('Ce devis a déjà été converti en commande'), { status: 409 });
  }

  const existing = await db.query(`SELECT id FROM orders WHERE quote_id = $1`, [quoteId]);
  if (existing.rows[0]) {
    throw Object.assign(new Error('Une commande existe déjà pour ce devis'), { status: 409 });
  }

  const linesRes = await db.query(
    `SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order, id`,
    [quoteId]
  );
  const lines = linesRes.rows;
  if (!lines.length) {
    throw Object.assign(new Error('Devis sans lignes'), { status: 400 });
  }

  const onQuoteLine = lines.find((l) => l.price_on_quote);
  if (onQuoteLine) {
    throw Object.assign(
      new Error('Impossible de commander : certaines lignes sont « sur devis »'),
      { status: 400 }
    );
  }

  const orderNumber = await nextOrderNumber();
  const ins = await db.query(
    `INSERT INTO orders (
       order_number, quote_id, user_id, status,
       subtotal_ht, shipping_ht, total_ht,
       subtotal_cdf, shipping_cdf, total_cdf,
       subtotal_usd, shipping_usd, total_usd,
       eur_to_cdf, eur_to_usd, shipping_rule_name, customer_snapshot
     ) VALUES ($1,$2,$3,'received',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      orderNumber,
      quoteId,
      userId,
      quote.subtotal_ht,
      quote.shipping_ht,
      quote.total_ht,
      quote.subtotal_cdf,
      quote.shipping_cdf,
      quote.total_cdf,
      quote.subtotal_usd,
      quote.shipping_usd,
      quote.total_usd,
      quote.eur_to_cdf,
      quote.eur_to_usd,
      quote.shipping_rule_name,
      quote.customer_snapshot,
    ]
  );
  const order = ins.rows[0];

  for (const line of lines) {
    await db.query(
      `INSERT INTO order_lines (
         order_id, reference_id, sku_code, internal_code, ref_pro,
         product_name, variant_label, diameter, qty,
         unit_price_ht, unit_price_cdf, unit_price_usd,
         line_total_ht, line_total_cdf, line_total_usd,
         price_on_quote, sort_order
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        order.id,
        line.reference_id,
        line.sku_code,
        line.internal_code,
        line.ref_pro,
        line.product_name,
        line.variant_label,
        line.diameter,
        line.qty,
        line.unit_price_ht,
        line.unit_price_cdf,
        line.unit_price_usd,
        line.line_total_ht,
        line.line_total_cdf,
        line.line_total_usd,
        line.price_on_quote,
        line.sort_order,
      ]
    );
  }

  await db.query(`UPDATE quotes SET status = 'converted', updated_at = NOW() WHERE id = $1`, [
    quoteId,
  ]);

  return { order, quote, lines };
}
