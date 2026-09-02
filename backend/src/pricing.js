/**
 * Calcul des prix de vente, marges et livraison.
 */

export function roundPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}

export function isOfferActive(offerPrice, offerEndsAt, now = new Date()) {
  if (offerPrice == null || offerPrice === '') return false;
  if (!offerEndsAt) return true;
  return new Date(offerEndsAt) > now;
}

/** Règle de marge la plus spécifique applicable */
export function pickMarginRule({ familyId, categoryId, brand }, rules) {
  const active = (rules || []).filter((r) => r.active !== false);
  const brandNorm = (brand || '').trim().toLowerCase();

  const scored = active
    .map((r) => {
      let score = r.priority || 0;
      if (r.family_id && r.family_id !== familyId) return null;
      if (r.family_id) score += 10;
      if (r.category_id && r.category_id !== categoryId) return null;
      if (r.category_id) score += 20;
      if (r.brand) {
        if (brandNorm !== r.brand.trim().toLowerCase()) return null;
        score += 30;
      }
      if (!r.family_id && !r.category_id && !r.brand) score = 1;
      return { rule: r, score };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.rule || { margin_percent: 0, fixed_markup: 0 };
}

export function computeSaleFromCatalog(catalogPrice, rule) {
  const catalog = Number(catalogPrice);
  if (!Number.isFinite(catalog) || catalog <= 0) return null;
  const pct = Number(rule?.margin_percent) || 0;
  const fixed = Number(rule?.fixed_markup) || 0;
  return roundPrice(catalog * (1 + pct / 100) + fixed);
}

/**
 * Prix effectif affiché au client pour une référence.
 */
export function resolveEffectivePrice(ref, product, marginRules, exception, now = new Date()) {
  const catalog = ref.price_catalog_ht ?? ref.price_ht ?? null;

  if (exception?.active !== false) {
    if (
      exception?.exception_type === 'offer' &&
      isOfferActive(exception.offer_price_ht, exception.offer_ends_at, now)
    ) {
      return {
        effective_price_ht: roundPrice(exception.offer_price_ht),
        price_source: 'offer',
        offer_label: exception.offer_label || 'Offre',
        price_catalog_ht: catalog,
      };
    }
    if (
      exception?.exception_type === 'manual_price' &&
      exception.price_sale_ht != null
    ) {
      return {
        effective_price_ht: roundPrice(exception.price_sale_ht),
        price_source: 'manual',
        price_catalog_ht: catalog,
      };
    }
    if (
      exception?.exception_type === 'margin_override' &&
      exception.margin_percent != null &&
      catalog != null
    ) {
      return {
        effective_price_ht: computeSaleFromCatalog(catalog, {
          margin_percent: exception.margin_percent,
          fixed_markup: exception.fixed_markup || 0,
        }),
        price_source: 'margin_override',
        margin_percent: exception.margin_percent,
        price_catalog_ht: catalog,
      };
    }
  }

  if (ref.price_is_manual && ref.price_sale_ht != null) {
    return {
      effective_price_ht: roundPrice(ref.price_sale_ht),
      price_source: 'manual',
      price_catalog_ht: catalog,
    };
  }

  if (isOfferActive(ref.offer_price_ht, ref.offer_ends_at, now)) {
    return {
      effective_price_ht: roundPrice(ref.offer_price_ht),
      price_source: 'offer',
      offer_label: ref.offer_label || 'Offre',
      price_catalog_ht: catalog,
    };
  }

  if (ref.price_sale_ht != null) {
    return {
      effective_price_ht: roundPrice(ref.price_sale_ht),
      price_source: 'margin',
      price_catalog_ht: catalog,
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

  return {
    effective_price_ht: computeSaleFromCatalog(catalog, rule),
    price_source: 'margin',
    margin_percent: rule.margin_percent,
    price_catalog_ht: catalog,
  };
}

export function enrichReference(ref, product, marginRules, exception) {
  const resolved = resolveEffectivePrice(ref, product, marginRules, exception);
  return {
    ...ref,
    price_catalog_ht: resolved.price_catalog_ht ?? ref.price_catalog_ht ?? ref.price_ht,
    effective_price_ht: resolved.effective_price_ht,
    price_source: resolved.price_source,
    offer_label: resolved.offer_label || null,
    display_price_ht: resolved.effective_price_ht ?? ref.price_catalog_ht ?? ref.price_ht,
  };
}

/** Frais de livraison pour un panier */
export function computeShipping(subtotalHt, rules, { familyIds = [] } = {}) {
  const active = (rules || []).filter((r) => r.active !== false);
  if (!active.length) return { fee_ht: 0, rule_name: null, free_shipping: subtotalHt <= 0 };

  const sub = Number(subtotalHt) || 0;

  const globalFree = active.find(
    (r) => r.rule_type === 'free_threshold' && r.free_above != null && sub >= Number(r.free_above)
  );
  if (globalFree) {
    return { fee_ht: 0, rule_name: globalFree.name, free_shipping: true };
  }

  const orderRules = active
    .filter((r) => r.rule_type === 'order_total' || r.rule_type === 'flat')
    .filter((r) => {
      if (r.family_id && familyIds.length && !familyIds.includes(r.family_id)) return false;
      const min = r.min_order_total != null ? Number(r.min_order_total) : 0;
      const max = r.max_order_total != null ? Number(r.max_order_total) : Infinity;
      return sub >= min && sub < max;
    })
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  if (orderRules.length) {
    const r = orderRules[0];
    return {
      fee_ht: roundPrice(r.fee_ht) || 0,
      rule_name: r.name,
      free_shipping: false,
    };
  }

  const flat = active.find((r) => r.rule_type === 'flat');
  if (flat && sub > 0) {
    return { fee_ht: roundPrice(flat.fee_ht) || 0, rule_name: flat.name, free_shipping: false };
  }

  return { fee_ht: 0, rule_name: null, free_shipping: false };
}
