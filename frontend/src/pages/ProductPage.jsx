import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Package, Box, ChevronRight } from 'lucide-react';
import { api, formatPrice, imageUrl } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const { addItem, count, total } = useCart();
  const [product, setProduct] = useState(null);
  const [qtys, setQtys] = useState({});
  const [pendingTotal, setPendingTotal] = useState({ count: 0, sum: 0 });

  useEffect(() => {
    api.getProduct(id).then(setProduct).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!product?.references) return;
    let c = 0;
    let s = 0;
    for (const r of product.references) {
      const q = qtys[r.code] || 0;
      c += q;
      s += q * (Number(r.display_price_ht) || 0);
    }
    setPendingTotal({ count: c, sum: s });
  }, [qtys, product]);

  const img = useMemo(() => {
    if (!product) return null;
    return imageUrl(
      product.image_path ||
        product.references?.find((r) => r.image_path)?.image_path
    );
  }, [product]);

  function setQty(code, value) {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setQtys((prev) => ({ ...prev, [code]: n }));
  }

  function addOne(ref) {
    const q = qtys[ref.code] || 0;
    if (q <= 0) {
      setQty(ref.code, 1);
      addItem(ref, 1, product.name);
      setQty(ref.code, 0);
    } else {
      addItem(ref, q, product.name);
      setQty(ref.code, 0);
    }
  }

  function addAll() {
    if (!product) return;
    for (const r of product.references) {
      const q = qtys[r.code] || 0;
      if (q > 0) addItem(r, q, product.name);
    }
    setQtys({});
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6">
        <div className="card p-8 text-center text-sm text-muted">Chargement du produit…</div>
      </div>
    );
  }

  const crumbs = [
    { label: 'Accueil', to: '/' },
    { label: 'Catalogue', to: '/' },
    product.family_name && { label: product.family_name },
    product.category_name && { label: product.category_name },
    { label: product.name },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-6 sm:px-6">
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
            {c.to ? (
              <Link to={c.to} className="transition hover:text-brand">
                {c.label}
              </Link>
            ) : (
              <span className={i === crumbs.length - 1 ? 'font-medium text-ink' : ''}>
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <div className="card flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-b from-surface to-white">
            {img ? (
              <img src={img} alt={product.name} className="h-full w-full object-contain p-8" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted/50">
                <Package className="h-16 w-16" />
                <span className="text-sm">Photo non disponible</span>
              </div>
            )}
          </div>
          <div className="card p-5">
            {product.brand && (
              <span className="inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                {product.brand}
              </span>
            )}
            <h1 className="font-display mt-3 text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {product.name}
            </h1>
            {product.description && (
              <p className="mt-3 text-sm leading-relaxed text-muted">{product.description}</p>
            )}
            {product.note && (
              <p className="mt-2 text-sm font-medium text-brand-dark">{product.note}</p>
            )}
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
              <Box className="h-4 w-4 text-brand" />
              {product.references?.length || 0} référence
              {(product.references?.length || 0) !== 1 ? 's' : ''} disponible
              {(product.references?.length || 0) !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-ink">Références & tarifs</h2>
            <p className="mt-1 text-sm text-muted">
              Sélectionnez les quantités puis ajoutez au panier
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Dimensions</th>
                    <th className="px-4 py-3">Réf. Pro</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Prix HT</th>
                    <th className="px-4 py-3">Cond.</th>
                    <th className="px-4 py-3">Qté</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(product.references || []).map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/60 transition hover:bg-brand-soft/30 ${
                        idx % 2 === 1 ? 'bg-surface/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-ink">{r.diameter || '—'}</td>
                      <td className="px-4 py-3 text-muted">{r.ref_pro || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{r.code}</td>
                    <td className="px-4 py-3 font-bold text-brand-dark">
                      {formatPrice(r.display_price_ht)}
                      {r.price_source === 'offer' && r.offer_label && (
                        <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          {r.offer_label}
                        </span>
                      )}
                    </td>
                      <td className="px-4 py-3 text-muted">×{r.vendu_par || '1'}</td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center overflow-hidden rounded-full border border-border bg-white">
                          <button
                            type="button"
                            className="px-2.5 py-1.5 text-muted transition hover:bg-surface"
                            onClick={() => setQty(r.code, (qtys[r.code] || 0) - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            className="w-10 border-x border-border py-1.5 text-center text-sm outline-none"
                            value={qtys[r.code] || 0}
                            onChange={(e) => setQty(r.code, e.target.value)}
                          />
                          <button
                            type="button"
                            className="px-2.5 py-1.5 text-muted transition hover:bg-surface"
                            onClick={() => setQty(r.code, (qtys[r.code] || 0) + 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => addOne(r)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            (qtys[r.code] || 0) > 0
                              ? 'bg-brand text-white shadow-sm hover:bg-brand-dark'
                              : 'border border-border text-muted hover:border-brand hover:text-brand'
                          }`}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Ajouter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-white/95 shadow-[0_-8px_30px_rgb(15_23_42_/0.08)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="text-sm">
            <span className="text-muted">Sélection en cours : </span>
            <span className="font-semibold text-ink">
              {pendingTotal.count} article{pendingTotal.count !== 1 ? 's' : ''} ·{' '}
              {formatPrice(pendingTotal.sum)}
            </span>
            {count > 0 && (
              <span className="ml-3 text-xs text-muted">
                (panier : {count} · {formatPrice(total)})
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={pendingTotal.count === 0}
            onClick={addAll}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-40"
          >
            Tout ajouter au panier
          </button>
        </div>
      </div>
    </div>
  );
}
