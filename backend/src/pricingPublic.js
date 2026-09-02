import {
  resolveEffectivePrice,
  pickMarginRule,
  computeSaleFromCatalog,
  roundPrice,
} from './pricing.js';

/**
 * Prix visiteur : marges appliquées dynamiquement sauf prix manuel / exception / offre.
 * N'expose jamais price_catalog_ht.
 */
export function resolvePublicDisplayPrice(ref, product, marginRules, exception) {
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

export function enrichReferencePublic(ref, product, marginRules, exception) {
  const pricing = resolvePublicDisplayPrice(ref, product, marginRules, exception);
  return {
    id: ref.id,
    code: ref.code,
    product_id: ref.product_id,
    ref_pro: ref.ref_pro,
    ref_four: ref.ref_four,
    diameter: ref.diameter,
    vendu_par: ref.vendu_par,
    note: ref.note,
    image_path: ref.image_path,
    display_price_ht: pricing.display_price_ht,
    price_source: pricing.price_source,
    offer_label: pricing.offer_label,
  };
}
