import { query } from '../db.js';
import { computeShipping } from '../pricing.js';
import { enrichReferencePublic } from '../pricingPublic.js';
import { getCurrencyRates, eurToCdfAmount, eurToUsdAmount } from '../currency.js';

async function loadPricingContext() {
  const marginRes = await query(`SELECT * FROM margin_rules WHERE active = true`);
  const excRes = await query(`SELECT * FROM price_exceptions WHERE active = true`);
  const exceptions = new Map(excRes.rows.map((row) => [row.code, row]));
  return { marginRules: marginRes.rows, exceptions };
}

async function resolveReference(code) {
  const raw = String(code || '').trim();
  if (!raw) return null;
  const norm = raw.toUpperCase().replace(/\s+/g, '');
  const r = await query(
    `SELECT r.*,
            p.name AS product_name,
            p.brand,
            p.family_id,
            p.category_id
     FROM references_sku r
     JOIN products p ON p.id = r.product_id
     WHERE r.code = $1
        OR UPPER(COALESCE(r.internal_code, '')) = $2
        OR r.ref_pro = $1
     LIMIT 1`,
    [raw, norm]
  );
  return r.rows[0] || null;
}

export async function buildQuoteFromItems(items) {
  if (!Array.isArray(items) || !items.length) {
    throw Object.assign(new Error('Panier vide'), { status: 400 });
  }

  const { marginRules, exceptions } = await loadPricingContext();
  const rates = getCurrencyRates();
  const lines = [];
  const errors = [];
  let subtotalHt = 0;
  let subtotalCdf = 0;
  let subtotalUsd = 0;
  const familyIds = new Set();

  for (let i = 0; i < items.length; i++) {
    const { code, qty } = items[i];
    const quantity = parseInt(qty, 10);
    if (!code || !Number.isFinite(quantity) || quantity <= 0) {
      errors.push({ code, reason: 'Quantité invalide' });
      continue;
    }

    const refRow = await resolveReference(code);
    if (!refRow) {
      errors.push({ code, reason: 'Référence introuvable' });
      continue;
    }

    const product = {
      family_id: refRow.family_id,
      category_id: refRow.category_id,
      brand: refRow.brand,
    };
    const enriched = enrichReferencePublic(
      refRow,
      product,
      marginRules,
      exceptions.get(refRow.code)
    );

    if (refRow.family_id) familyIds.add(refRow.family_id);

    const unitHt = enriched.display_price_ht;
    const unitCdf = enriched.display_price_cdf;
    const unitUsd = enriched.display_price_usd;
    const onQuote = Boolean(enriched.price_on_quote);

    let lineTotalHt = null;
    let lineTotalCdf = null;
    let lineTotalUsd = null;
    if (!onQuote && unitHt != null) {
      lineTotalHt = Math.round(unitHt * quantity * 10000) / 10000;
      subtotalHt += lineTotalHt;
    }
    if (!onQuote && unitCdf != null) {
      lineTotalCdf = unitCdf * quantity;
      subtotalCdf += lineTotalCdf;
    }
    if (!onQuote && unitUsd != null) {
      lineTotalUsd = Math.round(unitUsd * quantity * 100) / 100;
      subtotalUsd += lineTotalUsd;
    }

    lines.push({
      reference_id: refRow.id,
      sku_code: refRow.code,
      internal_code: refRow.internal_code,
      ref_pro: refRow.ref_pro,
      product_name: refRow.product_name,
      variant_label: refRow.variant_label,
      diameter: refRow.diameter,
      qty: quantity,
      unit_price_ht: unitHt,
      unit_price_cdf: unitCdf,
      unit_price_usd: unitUsd,
      line_total_ht: lineTotalHt,
      line_total_cdf: lineTotalCdf,
      line_total_usd: lineTotalUsd,
      price_on_quote: onQuote,
      sort_order: i + 1,
    });
  }

  if (!lines.length) {
    throw Object.assign(new Error('Aucune ligne valide'), { status: 400, details: errors });
  }

  const shipRules = await query(`SELECT * FROM shipping_rules WHERE active = true`);
  const shipping = computeShipping(subtotalHt, shipRules.rows, {
    familyIds: [...familyIds],
  });
  const shippingHt = shipping.free_shipping ? 0 : shipping.fee_ht || 0;
  const shippingCdf = eurToCdfAmount(shippingHt, rates) || 0;
  const shippingUsd = eurToUsdAmount(shippingHt, rates) || 0;
  const totalHt = Math.round((subtotalHt + shippingHt) * 10000) / 10000;
  const totalCdf = subtotalCdf + shippingCdf;
  const totalUsd = Math.round((subtotalUsd + shippingUsd) * 100) / 100;

  return {
    lines,
    errors,
    subtotal_ht: subtotalHt,
    shipping_ht: shippingHt,
    total_ht: totalHt,
    subtotal_cdf: subtotalCdf,
    shipping_cdf: shippingCdf,
    total_cdf: totalCdf,
    subtotal_usd: Math.round(subtotalUsd * 100) / 100,
    shipping_usd: shippingUsd,
    total_usd: totalUsd,
    eur_to_cdf: rates.eurToCdf,
    eur_to_usd: rates.eurToUsd,
    shipping_rule_name: shipping.rule_name,
    free_shipping: shipping.free_shipping,
  };
}

export async function nextQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const r = await query(
    `SELECT quote_number FROM quotes
     WHERE quote_number LIKE $1
     ORDER BY quote_number DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let seq = 1;
  if (r.rows[0]) {
    const last = r.rows[0].quote_number;
    const n = parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}
