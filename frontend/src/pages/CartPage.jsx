import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { api, formatCdf, eurToCdf, eurToUsd } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import PriceDisplay from '../components/PriceDisplay.jsx';

export default function CartPage() {
  const { items, setQty, clear, count, total_cdf, total_usd, total_eur } = useCart();
  const [shipping, setShipping] = useState(null);

  useEffect(() => {
    if (total_eur <= 0) {
      setShipping(null);
      return;
    }
    api
      .calculateShipping({ subtotal_ht: total_eur })
      .then(setShipping)
      .catch(() => setShipping(null));
  }, [total_eur]);

  const shippingCdf = shipping?.free_shipping ? 0 : eurToCdf(shipping?.fee_ht ?? 0);
  const shippingUsd = shipping?.free_shipping ? 0 : eurToUsd(shipping?.fee_ht ?? 0);
  const grandTotalCdf = total_cdf + shippingCdf;
  const grandTotalUsd = total_usd + shippingUsd;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Panier</h1>
        <p className="mt-1 text-sm text-muted">
          {count} article{count !== 1 ? 's' : ''} sélectionné{count !== 1 ? 's' : ''}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card flex flex-col items-center px-8 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h2 className="font-display text-lg font-bold">Votre panier est vide</h2>
          <p className="mt-2 text-sm text-muted">
            Parcourez le catalogue et ajoutez des références.
          </p>
          <Link
            to="/"
            className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Retour au catalogue
          </Link>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {items.map((i) => (
                <div key={i.code} className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{i.productName}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {i.variant_label && `${i.variant_label} · `}
                      {i.diameter && `${i.diameter} · `}
                      Réf. {i.ref_pro || '—'} · AFE {i.code}
                      {i.supplier_code && ` · Cat. ${i.supplier_code}`}
                      {i.offer_label && (
                        <span className="ml-1 text-accent">· {i.offer_label}</span>
                      )}
                    </div>
                  </div>
                  <PriceDisplay cdf={i.price_cdf} usd={i.price_usd} />
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                    value={i.qty}
                    onChange={(e) => setQty(i.code, parseInt(e.target.value, 10) || 0)}
                  />
                  <div className="min-w-[6rem] text-right">
                    <PriceDisplay cdf={i.qty * i.price_cdf} usd={i.qty * i.price_usd} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card mt-4 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Truck className="h-4 w-4 text-brand" />
              Livraison
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Sous-total articles HT</span>
              <PriceDisplay cdf={total_cdf} usd={total_usd} size="sm" />
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-muted">
                Frais de livraison HT
                {shipping?.rule_name && (
                  <span className="text-xs"> ({shipping.rule_name})</span>
                )}
              </span>
              <span className="font-medium">
                {shipping?.free_shipping ? (
                  <span className="text-brand">Offert</span>
                ) : (
                  <PriceDisplay cdf={shippingCdf} usd={shippingUsd} />
                )}
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-display font-bold text-ink">Total HT</span>
              <PriceDisplay cdf={grandTotalCdf} usd={grandTotalUsd} size="lg" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Vider le panier
            </button>
            <Link
              to="/panier/devis"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <FileText className="h-4 w-4" />
              Demander un devis
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
