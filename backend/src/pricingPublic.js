import {
  resolveEffectivePrice,
  pickMarginRule,
  computeSaleFromCatalog,
  roundPrice,
} from './pricing.js';
import { applyPublicCurrency } from './currency.js';

/**
 * Prix visiteur : marges appliquées dynamiquement sauf prix manuel / exception / offre.
 * N'expose jamais price_catalog_ht.
 */
export function resolvePublicDisplayPrice(ref, product, marginRules, exception) {
  if (ref.price_on_quote) {
    return {
      display_price_ht: null,
      price_source: 'quote',
      offer_label: null,
    };
  }

  const catalog = ref.price_catalog_ht ?? ref.price_ht ?? null;

  if (exception?.active !== false) {
    const resolved = resolveEffectivePrice(ref, product, marginRules, exception);
    return {
      display_price_ht: resolved.effective_price_ht,
      price_source: resolved.price_source,
      offer_label: resolved.offer_label || null,
    };
  }

  if (ref.price_is_manual && ref.price_sale_ht != null) {
    return {
      display_price_ht: roundPrice(ref.price_sale_ht),
      price_source: 'manual',
      offer_label: null,
    };
  }

  const resolved = resolveEffectivePrice(ref, product, marginRules, exception);
  if (resolved.price_source === 'offer') {
    return {
      display_price_ht: resolved.effective_price_ht,
      price_source: 'offer',
      offer_label: resolved.offer_label || null,
    };
  }

  const rule = pickMarginRule(
    {
      familyId: product?.family_id,
      categoryId: product?.category_id,
      brand: product?.brand,
    },
    marginRules
  );
  const sale = computeSaleFromCatalog(catalog, rule);

  return {
    display_price_ht: sale,
    price_source: sale != null ? 'margin' : null,
    offer_label: null,
  };
}

/** Code affiché au visiteur : code interne AFE, sinon code catalogue (transition). */
export function publicDisplayCode(ref) {
  const internal = ref.internal_code?.trim();
  if (internal) return internal.toUpperCase();
  return ref.code;
}

export function enrichReferencePublic(ref, product, marginRules, exception) {
  const pricing = resolvePublicDisplayPrice(ref, product, marginRules, exception);
  const withCurrency = applyPublicCurrency(pricing, ref);
  return {
    id: ref.id,
    code: publicDisplayCode(ref),
    /** Affichage temporaire — vérification correspondance AFE / catalogue */
    supplier_code: ref.code,
    product_id: ref.product_id,
    ref_pro: ref.ref_pro,
    ref_four: ref.ref_four,
    diameter: ref.diameter,
    vendu_par: ref.vendu_par,
    note: ref.note,
    image_path: ref.image_path,
    variant_label: ref.variant_label,
    sort_order: ref.sort_order,
    display_price_ht: withCurrency.display_price_ht,
    display_price_cdf: withCurrency.display_price_cdf,
    display_price_usd: withCurrency.display_price_usd,
    price_source: withCurrency.price_source,
    price_currency_mode: withCurrency.price_currency_mode,
    price_on_quote: Boolean(ref.price_on_quote),
    price_is_manual_cdf: Boolean(ref.price_is_manual_cdf),
    offer_label: withCurrency.offer_label,
  };
}
