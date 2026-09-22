import crypto from 'crypto';
import { query } from '../db.js';

const TOKEN_BYTES = 32;
const TTL_MS = 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createResetToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

export async function storePasswordResetToken(userId, token) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TTL_MS);
  await query(`DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`, [
    userId,
  ]);
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return expiresAt;
}

export async function consumePasswordResetToken(token) {
  const tokenHash = hashToken(token);
  const r = await query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  const row = r.rows[0];
  if (!row || row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
  return row.user_id;
}
