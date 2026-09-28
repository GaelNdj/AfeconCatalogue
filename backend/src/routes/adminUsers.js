import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { sendAccountDeletionWarningEmail } from '../services/mail.js';
import {
  DELETION_NOTICE_DAYS,
  applyDueDeletions,
  getAccountById,
  listAccounts,
  markStaleAccountsInactive,
  toAdminAccount,
} from '../services/accountLifecycle.js';

const router = Router();
router.use(requireAdmin);

function debugLog(hypothesisId, location, message, data) {
  // #region agent log
  fetch('http://127.0.0.1:7581/ingest/20d23877-a71f-467f-86e2-87ccf471af2f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '913862' },
    body: JSON.stringify({
      sessionId: '913862',
      runId: 'accounts-admin',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

router.get('/', async (_req, res, next) => {
  try {
    const due = await applyDueDeletions();
    const marked = await markStaleAccountsInactive();
    const items = await listAccounts();
    debugLog('E', 'adminUsers.js:GET', 'listed accounts', {
      total: items.length,
      inactive: items.filter((u) => u.inactive).length,
      withOrders: items.filter((u) => u.order_count > 0).length,
      canDelete: items.filter((u) => u.can_delete && u.inactive).length,
      dueDeleted: due.deleted,
      markedInactive: marked,
    });
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
      debugLog('A', 'adminUsers.js:warn', 'blocked warn — has orders', {
        userId: id,
        orderCount: account.order_count,
      });
      return res.status(409).json({
        error: 'Ce compte a déjà commandé. Il ne peut pas être supprimé.',
      });
    }
    if (!account.inactive) {
      return res.status(400).json({
        error: 'Le préavis ne s’applique qu’aux comptes inactifs depuis plus d’un an.',
      });
    }

    const scheduled = await query(
      `UPDATE users
       SET status = 'pending_deletion',
           deletion_scheduled_at = NOW() + ($2 || ' days')::interval,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, deletion_scheduled_at`,
      [id, String(DELETION_NOTICE_DAYS)]
    );

    const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const mail = await sendAccountDeletionWarningEmail({
      email: account.email,
      companyName: account.company_name,
      loginUrl: `${base}/connexion`,
      days: DELETION_NOTICE_DAYS,
    });

    debugLog('C', 'adminUsers.js:warn', 'warning scheduled', {
      userId: id,
      mailSent: mail.sent,
      scheduledAt: scheduled.rows[0]?.deletion_scheduled_at,
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
      debugLog('A', 'adminUsers.js:delete', 'blocked delete — has orders', {
        userId: id,
        orderCount: account.order_count,
      });
      return res.status(409).json({
        error: 'Ce compte a déjà commandé. Il ne peut pas être supprimé.',
      });
    }
    if (!account.inactive) {
      return res.status(400).json({
        error: 'La suppression immédiate ne s’applique qu’aux comptes inactifs depuis plus d’un an.',
      });
    }

    await query(`DELETE FROM users WHERE id = $1`, [id]);
    debugLog('B', 'adminUsers.js:delete', 'deleted account without orders', {
      userId: id,
      orderCount: account.order_count,
    });
    res.json({ ok: true, deletedId: id });
  } catch (e) {
    next(e);
  }
});

export default router;
