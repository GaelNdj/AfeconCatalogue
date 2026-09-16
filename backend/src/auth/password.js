import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !password) return false;
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const derived = await scryptAsync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (keyBuf.length !== derived.length) return false;
  return timingSafeEqual(derived, keyBuf);
}

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères';
  }
  return null;
}

export function validateEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    return 'Adresse e-mail invalide';
  }
  return null;
}
