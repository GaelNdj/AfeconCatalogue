import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { api } from '../../api.js';
import PriceDisplay from '../../components/PriceDisplay.jsx';
import { adminPath } from '../../adminPaths.js';

const PAYMENT_LABELS = {
  pending: 'En attente',
  paid: 'Payée',
  failed: 'Échoué',
};

const STATUS_LABELS = {
  pending_payment: 'En attente de paiement',
  received: 'Reçue',
  preparing: 'En préparation',
  shipped: 'Expédiée',
};

function formatDateFr(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('fr-FR');
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    api
      .getAdminOrder(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await api.downloadAdminOrderPdf(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setPdfBusy(false);
    }
  }

  if (error && !data) {
    return (
      <p className="text-sm text-red-600">{error}</p>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  const { order, lines } = data;
  const snap = order.customer_snapshot || {};

  return (
    <div>
      <Link
        to={adminPath('commandes')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour aux commandes
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{order.order_number}</h2>
          <p className="text-sm text-muted">
            Devis {order.quote_number} · {new Date(order.created_at).toLocaleString('fr-FR')}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-muted">Statut :</span>{' '}
            {STATUS_LABELS[order.status] || order.status}
            <span className="mx-2 text-border">·</span>
            <span className="text-muted">Paiement :</span>{' '}
            {PAYMENT_LABELS[order.payment_status] || order.payment_status}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {pdfBusy ? 'PDF…' : 'PDF achat fournisseur'}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4 text-brand" />
          Récapitulatif commande (achat)
        </div>
        <p className="text-sm text-muted">
          {snap.company_name || order.company_name}
          {(snap.email || order.user_email) && ` · ${snap.email || order.user_email}`}
          {(snap.phone || order.user_phone) && ` · ${snap.phone || order.user_phone}`}
          {(snap.city || order.user_city) && ` · ${snap.city || order.user_city}`}
        </p>
        {order.quote_valid_until && (
          <p className="mt-2 text-sm text-muted">
            Devis valable jusqu&apos;au {formatDateFr(order.quote_valid_until)}
          </p>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="py-2 pr-2">Désignation</th>
                <th className="py-2 px-2">Réf. interne</th>
                <th className="py-2 px-2">Code cat.</th>
                <th className="py-2 px-2">Qté</th>
                <th className="py-2 pl-2 text-right">P.U. USD</th>
                <th className="py-2 pl-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{line.product_name}</div>
                    {line.variant_label && (
                      <div className="text-xs text-muted">{line.variant_label}</div>
                    )}
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">
                    {line.internal_code || line.ref_pro || '—'}
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{line.sku_code || '—'}</td>
                  <td className="py-2 px-2">{line.qty}</td>
                  <td className="py-2 pl-2 text-right">
                    {line.price_on_quote ? (
                      <span className="text-muted">Sur devis</span>
                    ) : (
                      <PriceDisplay
                        cdf={line.unit_price_cdf}
                        usd={line.unit_price_usd}
                        layout="usdPrimary"
                        size="sm"
                      />
                    )}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    {line.price_on_quote ? (
                      <span className="text-muted">Sur devis</span>
                    ) : (
                      <PriceDisplay
                        cdf={line.line_total_cdf}
                        usd={line.line_total_usd}
                        layout="usdPrimary"
                        size="sm"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Sous-total HT</span>
            <PriceDisplay
              cdf={order.subtotal_cdf}
              usd={order.subtotal_usd}
              layout="usdPrimary"
              size="sm"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Livraison HT</span>
            <PriceDisplay
              cdf={order.shipping_cdf}
              usd={order.shipping_usd}
              layout="usdPrimary"
              size="sm"
            />
          </div>
          <div className="flex justify-between font-bold text-ink">
            <span>Total HT</span>
            <PriceDisplay
              cdf={order.total_cdf}
              usd={order.total_usd}
              layout="usdPrimary"
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
