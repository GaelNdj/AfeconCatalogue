import { randomBytes } from 'crypto';
import { query } from '../db.js';

const SESSION_DAYS = 7;

export function sessionMaxAgeMs() {
  return SESSION_DAYS * 24 * 60 * 60 * 1000;
}

export async function createSession(userId) {
  const id = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs());
  await query(
    `INSERT INTO user_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [id, userId, expiresAt]
  );
  return { id, expiresAt };
}

export async function destroySession(sessionId) {
  if (!sessionId) return;
  await query(`DELETE FROM user_sessions WHERE id = $1`, [sessionId]);
}

export async function findUserBySession(sessionId) {
  if (!sessionId) return null;
  const r = await query(
    `SELECT u.id, u.email, u.company_name, u.phone, u.address_line, u.city, u.created_at
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()
     LIMIT 1`,
    [sessionId]
  );
  return r.rows[0] || null;
}

export async function purgeExpiredSessions() {
  await query(`DELETE FROM user_sessions WHERE expires_at <= NOW()`);
}
