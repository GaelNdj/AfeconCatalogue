import { query } from './db.js';
import { enrichReference } from './pricing.js';
import { enrichReferencePublic } from './pricingPublic.js';

let marginCache = { at: 0, rules: [] };
let exceptionCache = { at: 0, map: new Map() };
const CACHE_MS = 30_000;

async function getMarginRules() {
  if (Date.now() - marginCache.at < CACHE_MS) return marginCache.rules;
  const r = await query(`SELECT * FROM margin_rules WHERE active = true`);
  marginCache = { at: Date.now(), rules: r.rows };
  return r.rows;
}

async function getExceptionMap() {
  if (Date.now() - exceptionCache.at < CACHE_MS) return exceptionCache.map;
  const r = await query(`SELECT * FROM price_exceptions WHERE active = true`);
  const map = new Map(r.rows.map((row) => [row.code, row]));
  exceptionCache = { at: Date.now(), map };
  return map;
}

export function invalidatePricingCache() {
  marginCache.at = 0;
  exceptionCache.at = 0;
}

export async function enrichReferences(refs, product) {
  const [marginRules, exceptions] = await Promise.all([
    getMarginRules(),
    getExceptionMap(),
  ]);
  return refs.map((ref) =>
    enrichReference(ref, product, marginRules, exceptions.get(ref.code))
  );
}

export async function enrichReferencesPublic(refs, product) {
  const [marginRules, exceptions] = await Promise.all([
    getMarginRules(),
    getExceptionMap(),
  ]);
  return refs.map((ref) =>
    enrichReferencePublic(ref, product, marginRules, exceptions.get(ref.code))
  );
}

export async function enrichReferenceRow(ref, product) {
  const [marginRules, exceptions] = await Promise.all([
    getMarginRules(),
    getExceptionMap(),
  ]);
  return enrichReference(ref, product, marginRules, exceptions.get(ref.code));
}
