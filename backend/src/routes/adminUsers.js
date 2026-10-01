import { Router } from 'express';
import { query } from '../db.js';
import { CATALOGUE_USERS } from '../auth/catalogueUsers.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendAccountDeletionWarningEmail } from '../services/mail.js';
import {
  DELETION_NOTICE_DAYS,
  applyDueDeletions,
  ensureUserAccountColumns,
  getAccountById,
  listAccounts,
  markStaleAccountsInactive,
  toAdminAccount,
} from '../services/accountLifecycle.js';

const router = Router();
router.use(requireAdmin);

router.get('/', async (_req, res, next) => {
  try {
    await ensureUserAccountColumns();
    const due = await applyDueDeletions();
    const marked = await markStaleAccountsInactive();
    const items = await listAccounts();
    res.json({ items, due, markedInactive: marked });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/warn', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await getAccountById(id);
    if (!row) return res.status(404).json({ error: 'Compte introuvable' });
    const account = toAdminAccount(row);

    if (!account.can_delete) {
      return res.status(409).json({
        error: 'Ce compte a déjà commandé. Il ne peut pas être supprimé.',
      });
    }
    if (!account.inactive) {
      return res.status(400).json({
        error: 'Le préavis ne s’applique qu’aux comptes inactifs depuis plus d’un an.',
      });
    }

    await query(
      `UPDATE public.${CATALOGUE_USERS}
       SET status = 'pending_deletion',
           deletion_scheduled_at = NOW() + ($2 || ' days')::interval,
           updated_at = NOW()
       WHERE id = $1`,
      [id, String(DELETION_NOTICE_DAYS)]
    );

    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const mail = await sendAccountDeletionWarningEmail({
      email: account.email,
      companyName: account.company_name,
      loginUrl: `${base}/connexion`,
      days: DELETION_NOTICE_DAYS,
    });

    const updated = toAdminAccount(await getAccountById(id));
    res.json({ account: updated, mailSent: mail.sent });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await getAccountById(id);
    if (!row) return res.status(404).json({ error: 'Compte introuvable' });
    const account = toAdminAccount(row);

    if (!account.can_delete) {
      return res.status(409).json({
        error: 'Ce compte a déjà commandé. Il ne peut pas être supprimé.',
      });
    }
    if (!account.inactive) {
      return res.status(400).json({
        error: 'La suppression immédiate ne s’applique qu’aux comptes inactifs depuis plus d’un an.',
      });
    }

    await query(`DELETE FROM public.${CATALOGUE_USERS} WHERE id = $1`, [id]);
    res.json({ ok: true, deletedId: id });
  } catch (e) {
    next(e);
  }
});

export default router;
