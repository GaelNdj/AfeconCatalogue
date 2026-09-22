import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, Download, Package } from 'lucide-react';
import { api } from '../api.js';
import PriceDisplay from '../components/PriceDisplay.jsx';
import RequireAuth from '../components/RequireAuth.jsx';

const STATUS_LABELS = {
  pending_payment: 'En attente de paiement',
  received: 'Reçue',
  preparing: 'En préparation',
  shipped: 'Expédiée',
};

const PAYMENT_LABELS = {
  pending: 'Paiement en attente',
  paid: 'Payée',
  failed: 'Paiement échoué',
};

function OrderDetailInner() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    api
      .getOrder(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await api.downloadOrderPdf(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setPdfBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
        Chargement…
      </div>
    );
  }

  const { order, lines } = data;
  const snap = order.customer_snapshot || {};

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {order.payment_status === 'paid' ? 'Commande confirmée' : 'Commande enregistrée'}
          </h1>
          <p className="text-sm text-muted">
            {order.order_number} · {new Date(order.created_at).toLocaleString('fr-FR')}
          </p>
          <p className="mt-1 text-sm font-medium text-brand-dark">
            {STATUS_LABELS[order.status] || order.status}
            {order.payment_status && (
              <span className="text-muted">
                {' '}
                · {PAYMENT_LABELS[order.payment_status] || order.payment_status}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Package className="h-4 w-4 text-brand" />
          Récapitulatif
        </div>
        <p className="text-sm text-muted">
          {snap.company_name}
          {snap.phone && ` · ${snap.phone}`}
          {snap.city && ` · ${snap.city}`}
        </p>
        {order.quote_number && (
          <p className="mt-2 text-sm text-muted">
            Devis d&apos;origine :{' '}
            <Link to={`/compte/devis/${order.quote_id}`} className="text-brand hover:underline">
              {order.quote_number}
            </Link>
          </p>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                <th className="py-2 pr-2">Désignation</th>
                <th className="py-2 px-2">Qté</th>
                <th className="py-2 pl-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{line.product_name}</div>
                    <div className="text-xs text-muted">
                      {line.variant_label && `${line.variant_label} · `}
                      {line.internal_code || line.sku_code}
                    </div>
                  </td>
                  <td className="py-2 px-2">{line.qty}</td>
                  <td className="py-2 pl-2 text-right">
                    <PriceDisplay
                      cdf={line.line_total_cdf}
                      usd={line.line_total_usd}
                      layout="stacked"
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Sous-total HT</span>
            <PriceDisplay cdf={order.subtotal_cdf} usd={order.subtotal_usd} size="sm" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Livraison HT</span>
            <PriceDisplay cdf={order.shipping_cdf} usd={order.shipping_usd} size="sm" />
          </div>
          <div className="flex justify-between font-bold text-ink">
            <span>Total HT</span>
            <PriceDisplay cdf={order.total_cdf} usd={order.total_usd} size="sm" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {order.payment_status !== 'paid' && (
          <Link
            to={`/compte/commande/${order.id}/paiement`}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            <CreditCard className="h-4 w-4" />
            Procéder au paiement
          </Link>
        )}
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {pdfBusy ? 'Téléchargement…' : 'Télécharger le PDF'}
        </button>
        <Link
          to="/compte"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface"
        >
          Mon compte
        </Link>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderDetailInner />
    </RequireAuth>
  );
}
