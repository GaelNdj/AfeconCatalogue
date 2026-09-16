import { parseCookies, getSessionCookieName } from '../auth/cookies.js';
import { findUserBySession } from '../auth/session.js';

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

/** Vérifie Origin/Referer sur requêtes mutantes (complément SameSite). */
export function assertSameOrigin(req, res, next) {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  if (!origin && !referer) return next();
  const allowed = [frontendOrigin];
  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }
  if (!origin && referer && !referer.startsWith(frontendOrigin)) {
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
