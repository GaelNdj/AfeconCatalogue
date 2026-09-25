import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { hashPassword, verifyPassword, validateEmail, validatePassword } from '../auth/password.js';
import {
  createSession,
  destroySession,
  sessionMaxAgeMs,
  purgeExpiredSessions,
} from '../auth/session.js';
import { setSessionCookie, clearSessionCookie } from '../auth/cookies.js';
import { assertSameOrigin, attachUser, requireUser } from '../middleware/userAuth.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../services/mail.js';
import {
  createResetToken,
  storePasswordResetToken,
  consumePasswordResetToken,
} from '../services/passwordReset.js';

const router = Router();
const isProd = process.env.NODE_ENV === 'production';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
});

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    company_name: row.company_name,
    contact_name: row.contact_name || '',
    phone: row.phone,
    address_line: row.address_line,
    city: row.city,
  };
}

async function loginUser(res, userId) {
  await purgeExpiredSessions();
  const session = await createSession(userId);
  setSessionCookie(res, session.id, {
    maxAgeMs: sessionMaxAgeMs(),
    secure: isProd,
  });
}

router.get('/me', attachUser, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/register', authLimiter, assertSameOrigin, async (req, res, next) => {
  try {
    const emailErr = validateEmail(req.body?.email);
    if (emailErr) return res.status(400).json({ error: emailErr });
    const passErr = validatePassword(req.body?.password);
    if (passErr) return res.status(400).json({ error: passErr });

    const email = String(req.body.email).trim().toLowerCase();
    const company = String(req.body.company_name || '').trim();
    if (!company) {
      return res.status(400).json({ error: 'Nom de société requis' });
    }
    const contactName = String(req.body.contact_name || '').trim();
    if (!contactName) {
      return res.status(400).json({ error: 'Nom et prénom requis' });
    }

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail' });
    }

    const passwordHash = await hashPassword(req.body.password);
    const ins = await query(
      `INSERT INTO users (email, password_hash, company_name, contact_name, phone, address_line, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, company_name, contact_name, phone, address_line, city`,
      [
        email,
        passwordHash,
        company,
        contactName,
        req.body.phone?.trim() || null,
        req.body.address_line?.trim() || null,
        req.body.city?.trim() || null,
      ]
    );
    const user = ins.rows[0];
    await loginUser(res, user.id);
    const welcome = await sendWelcomeEmail({ email: user.email, companyName: user.company_name });
    res.status(201).json({ user: publicUser(user), welcomeEmailSent: welcome.sent });
  } catch (e) {
    next(e);
  }
});

router.post('/login', authLimiter, assertSameOrigin, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail et mot de passe requis' });
    }

    const r = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = r.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    await loginUser(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/forgot-password', authLimiter, assertSameOrigin, async (req, res, next) => {
  try {
    const emailErr = validateEmail(req.body?.email);
    if (emailErr) return res.status(400).json({ error: emailErr });
    const email = String(req.body.email).trim().toLowerCase();

    const r = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    const user = r.rows[0];
    if (user) {
      const token = createResetToken();
      await storePasswordResetToken(user.id, token);
      const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const resetUrl = `${base}/mot-de-passe/reinitialiser?token=${token}`;
      await sendPasswordResetEmail({ email, resetUrl });
    }

    res.json({
      ok: true,
      message:
        'Si un compte existe avec cet e-mail, vous recevrez un lien de réinitialisation sous peu.',
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.post('/reset-password', authLimiter, assertSameOrigin, async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const passErr = validatePassword(req.body?.password);
    if (!token) return res.status(400).json({ error: 'Lien invalide ou expiré' });
    if (passErr) return res.status(400).json({ error: passErr });

    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      return res.status(400).json({ error: 'Lien invalide ou expiré' });
    }

    const passwordHash = await hashPassword(req.body.password);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      passwordHash,
      userId,
    ]);

    res.json({ ok: true, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', assertSameOrigin, attachUser, async (req, res, next) => {
  try {
    if (req.sessionId) await destroySession(req.sessionId);
    clearSessionCookie(res, { secure: isProd });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.put('/profile', assertSameOrigin, attachUser, requireUser, async (req, res, next) => {
  try {
    const company = String(req.body?.company_name || '').trim();
    if (!company) {
      return res.status(400).json({ error: 'Nom de société requis' });
    }
    const r = await query(
      `UPDATE users SET
         company_name = $1,
         contact_name = $2,
         phone = $3,
         address_line = $4,
         city = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, email, company_name, contact_name, phone, address_line, city`,
      [
        company,
        req.body.contact_name?.trim() || null,
        req.body.phone?.trim() || null,
        req.body.address_line?.trim() || null,
        req.body.city?.trim() || null,
        req.user.id,
      ]
    );
    res.json({ user: publicUser(r.rows[0]) });
  } catch (e) {
    next(e);
  }
});

export default router;
