import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { api, formatCdf, formatPrice, formatUsd } from '../api.js';
import RequireAuth from '../components/RequireAuth.jsx';

function OrderPaymentInner() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [paymentConfig, setPaymentConfig] = useState({ stripe_configured: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const paidReturn = searchParams.get('paid') === '1';
  const cancelled = searchParams.get('cancelled') === '1';
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    api.getPaymentConfig().then(setPaymentConfig).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getOrder(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!paidReturn || !sessionId || !data?.order) return;
    if (data.order.payment_status === 'paid') return;

    let cancelledEffect = false;
    setConfirming(true);
    api
      .confirmOrderPayment(id, sessionId)
      .then(() => {
        if (cancelledEffect) return;
        navigate(`/compte/commande/${id}`, { replace: true });
      })
      .catch((e) => {
        if (!cancelledEffect) setError(e.message);
      })
      .finally(() => {
        if (!cancelledEffect) setConfirming(false);
      });

    return () => {
      cancelledEffect = true;
    };
  }, [paidReturn, sessionId, data?.order?.payment_status, data?.order, id, navigate]);

  async function pay() {
    setError('');
    setBusy(true);
    try {
      const { url } = await api.createOrderCheckoutSession(id);
      window.location.href = url;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-red-600">{error}</div>
    );
  }

  if (!data || confirming) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-brand" />
        {confirming ? 'Confirmation du paiement…' : 'Chargement…'}
      </div>
    );
  }

  const { order } = data;
  const isPaid = order.payment_status === 'paid';

  if (isPaid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
        <h1 className="font-display mt-4 text-2xl font-bold text-ink">Paiement confirmé</h1>
        <p className="mt-2 text-sm text-muted">{order.order_number}</p>
        <Link
          to={`/compte/commande/${id}`}
          className="mt-6 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Voir ma commande
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Paiement de la commande</h1>
      <p className="mt-1 text-sm text-muted">{order.order_number}</p>

      {cancelled && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="card mt-6 p-5">
        <p className="text-sm text-muted">Montant total HT à régler</p>
        <p className="mt-1 font-display text-2xl font-bold text-ink">
          {formatPrice(order.total_ht)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {formatCdf(order.total_cdf)}
          {order.total_usd != null && ` · ${formatUsd(order.total_usd)}`}
        </p>

        {!paymentConfig.stripe_configured ? (
          <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
            Le paiement en ligne n&apos;est pas encore configuré sur ce site. Contactez-nous pour
            finaliser votre commande.
          </p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={pay}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            <CreditCard className="h-4 w-4" />
            {busy ? 'Redirection…' : 'Payer par carte bancaire'}
          </button>
        )}

        <p className="mt-3 text-center text-[11px] text-muted">
          Paiement sécurisé via Stripe (carte Visa, Mastercard, etc.).
        </p>
      </div>

      <div className="mt-6 flex justify-center gap-3 text-sm">
        <Link to={`/compte/commande/${id}`} className="text-brand hover:underline">
          Retour à la commande
        </Link>
        <Link to="/" className="text-muted hover:text-ink">
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}

export default function OrderPaymentPage() {
  return (
    <RequireAuth>
      <OrderPaymentInner />
    </RequireAuth>
  );
}
