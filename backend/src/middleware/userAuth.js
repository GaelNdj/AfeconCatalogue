import { parseCookies, getSessionCookieName } from '../auth/cookies.js';
import { findUserBySession } from '../auth/session.js';
import { getAllowedFrontendOrigins, isFrontendOriginAllowed } from '../frontendOrigin.js';

/** Vérifie Origin/Referer sur requêtes mutantes (complément SameSite). */
export function assertSameOrigin(req, res, next) {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  if (!origin && !referer) return next();
  if (!isFrontendOriginAllowed(origin, referer)) {
    // #region agent log
    fetch('http://127.0.0.1:7581/ingest/20d23877-a71f-467f-86e2-87ccf471af2f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '913862' },
      body: JSON.stringify({
        sessionId: '913862',
        runId: 'origin-fix',
        hypothesisId: 'O1',
        location: 'userAuth.js:assertSameOrigin',
        message: 'origin rejected',
        data: {
          origin: origin || null,
          referer: referer ? referer.slice(0, 80) : null,
          allowed: getAllowedFrontendOrigins(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return res.status(403).json({ error: 'Origine non autorisée' });
  }
  next();
}

export async function attachUser(req, _res, next) {
  try {
    const cookies = parseCookies(req);
    const sessionId = cookies[getSessionCookieName()];
    req.user = sessionId ? await findUserBySession(sessionId) : null;
    req.sessionId = sessionId || null;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Connexion requise' });
  }
  next();
}
