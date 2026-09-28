import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';

function formatDate(value) {
  if (!value) return 'Jamais';
  return new Date(value).toLocaleDateString('fr-FR');
}

function StatusBadge({ account }) {
  if (account.order_count > 0) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
        A déjà commandé
      </span>
    );
  }
  if (account.status === 'pending_deletion') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Préavis suppression
      </span>
    );
  }
  if (account.inactive) {
    return (
      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
        Inactif &gt; 1 an
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Actif
    </span>
  );
}

export default function AdminAccounts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('inactive');

  async function load() {
    const r = await api.getAdminUsers();
    setItems(r.items || []);
    // #region agent log
    fetch('http://127.0.0.1:7581/ingest/20d23877-a71f-467f-86e2-87ccf471af2f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '913862' },
      body: JSON.stringify({
        sessionId: '913862',
        runId: 'accounts-admin',
        hypothesisId: 'E',
        location: 'AdminAccounts.jsx:load',
        message: 'admin accounts loaded',
        data: {
          total: (r.items || []).length,
          inactiveNoOrder: (r.items || []).filter((u) => u.inactive && u.can_delete).length,
          withOrders: (r.items || []).filter((u) => u.order_count > 0).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'ordered') return items.filter((u) => u.order_count > 0);
    if (filter === 'pending') return items.filter((u) => u.status === 'pending_deletion');
    return items.filter((u) => u.inactive && u.order_count === 0);
  }, [items, filter]);

  async function warn(id) {
    if (
      !window.confirm(
        'Envoyer un e-mail de préavis ? Le compte sera supprimé dans 1 mois s’il ne se reconnecte pas.'
      )
    ) {
      return;
    }
    setBusyId(id);
    setError('');
    try {
      const r = await api.warnAdminUser(id);
      setItems((prev) => prev.map((u) => (u.id === id ? r.account : u)));
      if (!r.mailSent) setError('Préavis enregistré, mais l’e-mail n’a pas pu partir (SMTP).');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (
      !window.confirm(
        'Supprimer définitivement ce compte ? Uniquement possible s’il n’a jamais commandé. Cette action est irréversible.'
      )
    ) {
      return;
    }
    setBusyId(id);
    setError('');
    try {
      await api.deleteAdminUser(id);
      setItems((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  return (
    <div>
      <h2 className="mb-1 font-display text-xl font-bold text-ink">Comptes clients</h2>
      <p className="mb-4 text-sm text-muted">
        Les comptes inactifs depuis plus d’un an, sans aucun achat, peuvent être prévenus puis
        supprimés. Un client qui a déjà commandé est conservé.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { id: 'inactive', label: 'Inactifs sans achat' },
          { id: 'pending', label: 'Préavis en cours' },
          { id: 'ordered', label: 'Ont commandé' },
          { id: 'all', label: 'Tous' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filter === opt.id
                ? 'border-brand bg-brand text-white'
                : 'border-border text-muted hover:border-brand/40 hover:text-ink'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-muted">Aucun compte dans ce filtre.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Inscription</th>
                <th className="px-4 py-3">Dernière activité</th>
                <th className="px-4 py-3">Devis / cmd</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const actionsEnabled = u.can_delete && u.inactive && busyId !== u.id;
                return (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.company_name || '—'}</div>
                      <div className="text-xs text-muted">{u.contact_name || u.email}</div>
                      {u.contact_name ? (
                        <div className="text-xs text-muted">{u.email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.last_activity_at)}</td>
                    <td className="px-4 py-3 text-muted">
                      {u.quote_count} / {u.order_count}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge account={u} />
                      {u.deletion_scheduled_at && u.status === 'pending_deletion' ? (
                        <div className="mt-1 text-xs text-muted">
                          Suppression le {formatDate(u.deletion_scheduled_at)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {u.order_count > 0 ? (
                        <span className="text-xs text-muted">Conservation (achat)</span>
                      ) : u.inactive ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!actionsEnabled}
                            onClick={() => warn(u.id)}
                            className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-ink hover:border-brand/40 disabled:opacity-50"
                          >
                            Prévenir (1 mois)
                          </button>
                          <button
                            type="button"
                            disabled={!actionsEnabled}
                            onClick={() => remove(u.id)}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Supprimer
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Actif — pas d’action</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
