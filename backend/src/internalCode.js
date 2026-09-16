/** Codes internes AFE (AFE-CON-0001…) — identité pièce, distincte du code catalogue. */

export function formatAfeCode(n) {
  const num = String(Number(n));
  return `AFE-CON-${num.length < 4 ? num.padStart(4, '0') : num}`;
}

/**
 * Attribue un AFE-CON-NNNN à chaque référence encore sans code interne.
 * Continue après le plus grand numéro déjà présent. Retourne le nombre attribué.
 */
export async function assignMissingAfeCodes(client) {
  const r = await client.query(
    `WITH missing AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
       FROM references_sku
       WHERE internal_code IS NULL OR BTRIM(internal_code) = ''
     ),
     mx AS (
       SELECT COALESCE(
         MAX(CAST(SUBSTRING(internal_code FROM 9) AS INTEGER)),
         0
       ) AS m
       FROM references_sku
       WHERE internal_code ~ '^AFE-CON-[0-9]+$'
     ),
     upd AS (
       UPDATE references_sku r
       SET internal_code = 'AFE-CON-' || CASE
             WHEN mx.m + missing.rn < 10000
               THEN LPAD((mx.m + missing.rn)::text, 4, '0')
             ELSE (mx.m + missing.rn)::text
           END,
           updated_at = NOW()
       FROM missing, mx
       WHERE r.id = missing.id
       RETURNING r.id, r.internal_code
     )
     SELECT COUNT(*)::int AS n,
            MIN(internal_code) AS first_code,
            MAX(internal_code) AS last_code
     FROM upd`
  );
  return r.rows[0] || { n: 0, first_code: null, last_code: null };
}
