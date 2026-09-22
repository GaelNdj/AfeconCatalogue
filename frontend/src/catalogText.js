const ACRONYMS = new Set([
  'WC', 'PVC', 'PER', 'PEHD', 'PE', 'PP', 'HT', 'BT', 'DN', 'PN', 'NF', 'CE', 'EU', 'LED', 'IP',
]);

const LOWER_UNITS = new Set(['MM', 'CM', 'KG', 'ML', 'CL']);

const SHORT_WORDS = new Set([
  'a', 'à', 'au', 'ce', 'de', 'du', 'en', 'et', 'il', 'la', 'le', 'ne', 'ni', 'on', 'ou', 'sa', 'se', 'si', 'un', 'y', 'or',
]);

/**
 * Recolle les mots coupés à l’import (« fi xer » → « fixer »),
 * sans toucher aux mots courts français (« en acier », « à partir »).
 */
function repairSplitWords(value) {
  return value.replace(/(^|[\s/])([a-z]{2}) ([a-z]{3,})/g, (full, sep, head, tail) => {
    if (SHORT_WORDS.has(head)) return full;
    return `${sep}${head}${tail}`;
  });
}

/** Retire les césures douces et recolle les mots coupés à l’import. */
export function cleanCatalogText(raw) {
  const value = String(raw ?? '')
    .replace(/[\u00AD\u200B\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return repairSplitWords(value);
}

/** Passe les mots entièrement en capitales en casse de titre, sans toucher au texte déjà mixte. */
function softenShouting(value) {
  return value.replace(/\p{L}+/gu, (word) => {
    const lower = word.toLocaleLowerCase('fr-FR');
    if (lower === 'à') return 'à';
    if (word.length < 2) return word;
    if (word !== word.toLocaleUpperCase('fr-FR')) return word;
    const up = word.toLocaleUpperCase('fr-FR');
    if (ACRONYMS.has(up)) return up;
    if (LOWER_UNITS.has(up)) return lower;
    return lower.charAt(0).toLocaleUpperCase('fr-FR') + lower.slice(1);
  });
}

/** Majuscules catalogue → texte lisible, en conservant les sigles courants. */
export function readableCatalogText(raw) {
  const value = cleanCatalogText(raw);
  if (!value) return '';
  return softenShouting(value);
}

/** Nom réduit à un diamètre / une cote (« 20 À 27MM »), sans type de pièce. */
export function isSpecOnlyName(raw) {
  const value = cleanCatalogText(raw);
  if (!value || value.length > 48) return false;
  const stripped = value
    .replace(/\d+([.,]\d+)?/g, '')
    .replace(/[øØx×/\\\-–—.,'’"°]/g, '')
    .replace(/\b(mm|cm|m|dn|pn|pouces?|à|a|et|ou)\b/gi, '')
    .replace(/\s+/g, '');
  return stripped.length <= 2;
}

export function displayBrand(raw) {
  const value = cleanCatalogText(raw);
  if (!value) return '';
  if (value.length <= 18 && value === value.toLocaleUpperCase('fr-FR')) return value;
  return readableCatalogText(value);
}
