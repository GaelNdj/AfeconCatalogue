import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileCheck, Truck } from 'lucide-react';
import { api, eurToCdf, eurToUsd, formatCdf } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PriceDisplay from '../components/PriceDisplay.jsx';
import RequireAuth from '../components/RequireAuth.jsx';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

function QuoteCheckoutInner() {
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

  async function submitQuote(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        items: items.map((i) => ({
          code: i.supplier_code || i.code,
          qty: i.qty,
        })),
        ...profile,
      };
      const res = await api.createQuote(payload);
      clear();
      navigate(`/compte/devis/${res.quote.id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Impossible de créer le devis');
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
      <h1 className="font-display text-3xl font-bold text-ink">Demander un devis</h1>
      <p className="mt-1 text-sm text-muted">
        Les prix seront recalculés et figés à la validation.
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

      <form onSubmit={submitQuote} className="card mt-4 space-y-4 p-5">
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
          disabled={busy}
          className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? 'Création du devis…' : 'Valider ma demande de devis'}
        </button>
      </form>
    </div>
  );
}

export default function QuoteCheckoutPage() {
  return (
    <RequireAuth>
      <QuoteCheckoutInner />
    </RequireAuth>
  );
}
