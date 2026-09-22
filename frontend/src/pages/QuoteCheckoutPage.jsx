import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileCheck, Truck } from 'lucide-react';
import { api, eurToCdf, eurToUsd } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PriceDisplay from '../components/PriceDisplay.jsx';
import RequireAuth from '../components/RequireAuth.jsx';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

function cartBlocksOnlineOrder(items) {
  return items.some((i) => i.price_source === 'quote' || !(Number(i.price_eur_ht) > 0));
}

function buildQuotePayload(items, profile) {
  return {
    items: items.map((i) => ({
      code: i.supplier_code || i.code,
      qty: i.qty,
    })),
    ...profile,
  };
}

function CartCheckoutInner({ mode }) {
  const isOrder = mode === 'order';
  const { user } = useAuth();
  const { items, total_cdf, total_usd, total_eur, clear } = useCart();
  const navigate = useNavigate();
  const [shipping, setShipping] = useState(null);
  const [profile, setProfile] = useState({
    company_name: '',
    phone: '',
    address_line: '',
    city: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const orderBlocked = isOrder && cartBlocksOnlineOrder(items);

  useEffect(() => {
    if (user) {
      setProfile({
        company_name: user.company_name || '',
        phone: user.phone || '',
        address_line: user.address_line || '',
        city: user.city || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (total_eur <= 0) {
      setShipping(null);
      return;
    }
    api.calculateShipping({ subtotal_ht: total_eur }).then(setShipping).catch(() => setShipping(null));
  }, [total_eur]);

  const shippingCdf = shipping?.free_shipping ? 0 : eurToCdf(shipping?.fee_ht ?? 0);
  const shippingUsd = shipping?.free_shipping ? 0 : eurToUsd(shipping?.fee_ht ?? 0);
  const grandTotalCdf = total_cdf + shippingCdf;

  async function onSubmit(e) {
    e.preventDefault();
    if (orderBlocked) return;
    setError('');
    setBusy(true);
    try {
      const payload = buildQuotePayload(items, profile);
      const res = await api.createQuote(payload);
      if (isOrder) {
        const orderRes = await api.createOrder({ quote_id: res.quote.id });
        clear();
        navigate(`/compte/commande/${orderRes.order.id}/paiement`, { replace: true });
      } else {
        clear();
        navigate(`/compte/devis/${res.quote.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || (isOrder ? 'Impossible de valider la commande' : 'Impossible de créer le devis'));
    } finally {
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">Votre panier est vide.</p>
        <Link to="/" className="mt-4 inline-block text-brand hover:underline">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">
        {isOrder ? 'Finaliser ma commande' : 'Enregistrer un devis'}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {isOrder
          ? 'Vérifiez vos coordonnées. Le paiement s’effectuera à l’étape suivante.'
          : 'Les montants catalogue seront figés pour votre dossier (PDF, validation interne).'}
      </p>

      <div className="card mt-6 divide-y divide-border">
        {items.map((i) => (
          <div key={i.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="font-medium text-ink">{i.productName}</div>
              <div className="text-xs text-muted">
                {i.variant_label && `${i.variant_label} · `}
                Qté {i.qty} · AFE {i.code}
              </div>
            </div>
            <PriceDisplay cdf={i.qty * i.price_cdf} usd={i.qty * i.price_usd} size="sm" />
          </div>
        ))}
      </div>

      <div className="card mt-4 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="h-4 w-4 text-brand" />
          Estimation livraison
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted">Total estimé HT</span>
          <PriceDisplay cdf={grandTotalCdf} usd={total_usd + shippingUsd} size="sm" />
        </div>
      </div>

      {orderBlocked && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Certaines lignes sont « sur devis » : la commande en ligne n’est pas disponible. Utilisez{' '}
          <Link to="/panier/devis" className="font-medium text-brand hover:underline">
            Enregistrer un devis
          </Link>{' '}
          ou retirez ces articles du panier.
        </p>
      )}

      <form onSubmit={onSubmit} className="card mt-4 space-y-4 p-5">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <FileCheck className="h-4 w-4 text-brand" />
          Vos coordonnées
        </div>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium">Société *</span>
          <input
            required
            className={`mt-1 ${inputClass}`}
            value={profile.company_name}
            onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Téléphone</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Adresse</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={profile.address_line}
            onChange={(e) => setProfile({ ...profile, address_line: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Ville</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={profile.city}
            onChange={(e) => setProfile({ ...profile, city: e.target.value })}
          />
        </label>
        <button
          type="submit"
          disabled={busy || orderBlocked}
          className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy
            ? isOrder
              ? 'Validation…'
              : 'Création du devis…'
            : isOrder
              ? 'Valider ma commande'
              : 'Enregistrer mon devis'}
        </button>
        <p className="text-center text-xs text-muted">
          {isOrder ? (
            <>
              Besoin d’un document pour validation interne ?{' '}
              <Link to="/panier/devis" className="text-brand hover:underline">
                Enregistrer un devis
              </Link>
            </>
          ) : (
            <>
              Prêt à commander ?{' '}
              <Link to="/panier/commande" className="text-brand hover:underline">
                Finaliser ma commande
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}

export default function QuoteCheckoutPage() {
  return (
    <RequireAuth>
      <CartCheckoutInner mode="quote" />
    </RequireAuth>
  );
}

export function OrderCheckoutPage() {
  return (
    <RequireAuth>
      <CartCheckoutInner mode="order" />
    </RequireAuth>
  );
}
