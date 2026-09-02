/** Protection routes admin — clé API dans header X-Admin-Key */

export function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(503).json({
      error: 'Admin non configuré. Définissez ADMIN_API_KEY dans backend/.env',
    });
  }
  const key = req.get('X-Admin-Key') || '';
  if (key !== expected) {
    return res.status(401).json({ error: 'Accès admin refusé' });
  }
  next();
}
