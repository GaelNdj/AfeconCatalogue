/** DTO publics — jamais exposer les prix fournisseur au visiteur */

const SENSITIVE_REF_FIELDS = new Set([
  'price_ht',
  'price_catalog_ht',
  'price_sale_ht',
  'price_is_manual',
  'effective_price_ht',
]);

export function toPublicReference(ref) {
  const display = ref.display_price_ht ?? ref.effective_price_ht ?? null;
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
    display_price_ht: display,
    price_source: ref.price_source || null,
    offer_label: ref.offer_label || null,
  };
}

export function stripSensitiveFromReference(ref) {
  const out = { ...ref };
  for (const k of SENSITIVE_REF_FIELDS) delete out[k];
  return out;
}
