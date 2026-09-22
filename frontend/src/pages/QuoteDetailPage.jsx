import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Download, FileText, ShoppingCart } from 'lucide-react';
import { api } from '../api.js';
import PriceDisplay from '../components/PriceDisplay.jsx';
import RequireAuth from '../components/RequireAuth.jsx';

function formatDateFr(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('fr-FR');
}

function QuoteDetailInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);

  useEffect(() => {
    api
      .getQuote(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await api.downloadQuotePdf(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function validateOrder() {
    setOrderBusy(true);
    setError('');
    try {
      const r = await api.createOrder({ quote_id: Number(id) });
      navigate(`/compte/commande/${r.order.id}/paiement`);
    } catch (e) {
      setError(e.message);
    } finally {
      setOrderBusy(false);
    }
  }

  if (error && !data) {
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

  const { quote, lines } = data;
  const snap = quote.customer_snapshot || {};
  const hasQuoteOnlyLines = lines.some((l) => l.price_on_quote);
  const canOrder = quote.status !== 'converted' && !hasQuoteOnlyLines;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Devis enregistré</h1>
          <p className="text-sm text-muted">
            {quote.quote_number} · {new Date(quote.created_at).toLocaleString('fr-FR')}
          </p>
          {quote.status === 'converted' && (
            <p className="mt-1 text-sm font-medium text-brand-dark">Commandé</p>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4 text-brand" />
          Récapitulatif
        </div>
        <p className="text-sm text-muted">
          {snap.company_name}
          {snap.phone && ` · ${snap.phone}`}
          {snap.city && ` · ${snap.city}`}
        </p>
        {quote.valid_until && (
          <p className="mt-2 text-sm text-muted">
            Valable jusqu&apos;au {formatDateFr(quote.valid_until)}
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
                    {line.price_on_quote ? (
                      <span className="text-muted">Sur devis</span>
                    ) : (
                      <PriceDisplay
                        cdf={line.line_total_cdf}
                        usd={line.line_total_usd}
                        layout="stacked"
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
            <PriceDisplay cdf={quote.subtotal_cdf} usd={quote.subtotal_usd} size="sm" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Livraison HT</span>
            <PriceDisplay cdf={quote.shipping_cdf} usd={quote.shipping_usd} size="sm" />
          </div>
          <div className="flex justify-between font-bold text-ink">
            <span>Total HT</span>
            <PriceDisplay cdf={quote.total_cdf} usd={quote.total_usd} size="sm" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {pdfBusy ? 'Téléchargement…' : 'Télécharger le PDF'}
        </button>
        {canOrder && (
          <button
            type="button"
            onClick={validateOrder}
            disabled={orderBusy}
            className="inline-flex items-center gap-2 rounded-full border border-brand bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-60"
          >
            <ShoppingCart className="h-4 w-4" />
            {orderBusy ? 'Validation…' : 'Valider la commande'}
          </button>
        )}
        {quote.order_id && (
          <Link
            to={`/compte/commande/${quote.order_id}`}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface"
          >
            Voir la commande
          </Link>
        )}
        <Link
          to="/compte"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface"
        >
          Mon compte
        </Link>
      </div>
      {hasQuoteOnlyLines && quote.status !== 'converted' && (
        <p className="mt-4 text-xs text-muted">
          Ce devis contient des lignes « sur devis » : la commande en ligne n&apos;est pas disponible.
        </p>
      )}
    </div>
  );
}

export default function QuoteDetailPage() {
  return (
    <RequireAuth>
      <QuoteDetailInner />
    </RequireAuth>
  );
}
