/** Origines autorisées (CORS + assertSameOrigin) — aligné prod Railway + local Vite. */

function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return trimmed;
  }
}

export function getAllowedFrontendOrigins() {
  const set = new Set();
  const add = (url) => {
    const n = normalizeOrigin(url);
    if (n) set.add(n);
  };
  add(process.env.FRONTEND_URL);
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) {
    add(`https://${railway}`);
    add(`http://${railway}`);
  }
  if (!set.size) set.add('http://localhost:5173');
  return [...set];
}

export function getPrimaryFrontendOrigin() {
  return getAllowedFrontendOrigins()[0];
}

function matchesAllowed(value, allowedList) {
  const norm = normalizeOrigin(value);
  if (!norm) return false;
  if (allowedList.includes(norm)) return true;
  try {
    const v = new URL(norm);
    return allowedList.some((a) => {
      try {
        const b = new URL(a);
        return b.host === v.host;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/** @param {string | undefined} origin Header Origin */
/** @param {string | undefined} referer Header Referer */
export function isFrontendOriginAllowed(origin, referer) {
  const allowed = getAllowedFrontendOrigins();
  if (origin) return matchesAllowed(origin, allowed);
  if (referer) {
    return allowed.some((a) => referer.startsWith(a) || referer.startsWith(`${a}/`));
  }
  return true;
}
