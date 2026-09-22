import { useEffect, useState } from 'react';
import { api, formatCdf, formatUsd } from '../../api.js';

const STATUS_OPTIONS = [
  { value: 'pending_payment', label: 'En attente de paiement' },
  { value: 'received', label: 'Reçue (payée)' },
  { value: 'preparing', label: 'En préparation' },
  { value: 'shipped', label: 'Expédiée' },
];

const PAYMENT_LABELS = {
  pending: 'En attente',
  paid: 'Payée',
  failed: 'Échoué',
};

export default function AdminOrders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api
      .getAdminOrders()
      .then((r) => setItems(r.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id, status) {
    setBusyId(id);
    setError('');
    try {
      const r = await api.updateAdminOrderStatus(id, status);
      setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status: r.order.status } : o)));
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
      <h2 className="mb-1 font-display text-xl font-bold text-ink">Commandes</h2>
      <p className="mb-6 text-sm text-muted">Suivi des commandes clients et mise à jour du statut.</p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-muted">Aucune commande pour le moment.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Devis</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Paiement</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{o.order_number}</td>
                  <td className="px-4 py-3">
                    <div>{o.company_name || '—'}</div>
                    <div className="text-xs text-muted">{o.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{o.quote_number}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(o.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div>{formatCdf(o.total_cdf)}</div>
                    {o.total_usd != null && (
                      <div className="text-xs text-muted">{formatUsd(o.total_usd)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {PAYMENT_LABELS[o.payment_status] || o.payment_status || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      disabled={busyId === o.id}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className="rounded-lg border border-border bg-white px-2 py-1.5 text-sm outline-none focus:border-brand/40"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
