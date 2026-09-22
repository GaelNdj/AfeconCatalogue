import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Package, Box, ChevronRight } from 'lucide-react';
import { api, imageUrl, isQuotePrice, formatCdf, formatUsd, QUOTE_PRICE_HINT, QUOTE_PRICE_TITLE } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import PriceDisplay from '../components/PriceDisplay.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const { addItem, count, total_cdf, total_usd } = useCart();
  const [product, setProduct] = useState(null);
  const [qtys, setQtys] = useState({});
  const [pendingTotal, setPendingTotal] = useState({ count: 0, sumCdf: 0, sumUsd: 0 });
  const [addedNotice, setAddedNotice] = useState(false);

  useEffect(() => {
    api.getProduct(id).then(setProduct).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (!product?.references) return;
    let c = 0;
    let sumCdf = 0;
    let sumUsd = 0;
    for (const r of product.references) {
      if (isQuotePrice(r)) continue;
      const q = qtys[r.code] || 0;
      c += q;
      sumCdf += q * (Number(r.display_price_cdf) || 0);
      sumUsd += q * (Number(r.display_price_usd) || 0);
    }
    setPendingTotal({ count: c, sumCdf, sumUsd });
  }, [qtys, product]);

  const hasQuoteRefs = useMemo(
    () => (product?.references || []).some((r) => isQuotePrice(r)),
    [product]
  );

  const heroPriceRef = useMemo(() => {
    const refs = product?.references || [];
    if (refs.length === 1) return refs[0];
    const priced = refs.filter((r) => !isQuotePrice(r) && r.display_price_cdf != null);
    if (!priced.length) return refs.length === 1 ? refs[0] : null;
    return priced.reduce((min, r) =>
      Number(r.display_price_cdf) < Number(min.display_price_cdf) ? r : min
    );
  }, [product]);

  const images = useMemo(() => {
    if (!product) return [];
    const seen = new Set();
    const out = [];
    const add = (path) => {
      const url = imageUrl(path);
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push(url);
    };
    add(product.image_path);
    for (const ref of product.references || []) {
      add(ref.image_path);
    }
    return out;
  }, [product]);

  function setQty(code, value) {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setQtys((prev) => ({ ...prev, [code]: n }));
  }

  function markAdded() {
    setAddedNotice(true);
  }

  function addOne(ref) {
    if (isQuotePrice(ref)) return;
    const q = qtys[ref.code] || 0;
    if (q <= 0) {
      setQty(ref.code, 1);
      addItem(ref, 1, product.name);
      setQty(ref.code, 0);
    } else {
      addItem(ref, q, product.name);
      setQty(ref.code, 0);
    }
    markAdded();
  }

  function addAll() {
    if (!product) return;
    let added = false;
    for (const r of product.references) {
      if (isQuotePrice(r)) continue;
      const q = qtys[r.code] || 0;
      if (q > 0) {
        addItem(r, q, product.name);
        added = true;
      }
    }
    setQtys({});
    if (added) markAdded();
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(660px,54rem)] lg:items-start">
        <div className="space-y-4 lg:max-w-xl">
          <div className="card p-5 sm:p-6">
            {product.brand && (
              <span className="inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                {product.brand}
              </span>
            )}
            <h1 className="font-display mt-3 text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {product.name}
            </h1>
            {product.note && (
              <p className="mt-2 text-sm font-medium text-brand-dark">{product.note}</p>
            )}
          </div>
          {images.length > 0 ? (
            images.length > 1 ? (
              <div className="flex items-end justify-center gap-3">
                {images.map((src, i) => (
                  <div
                    key={src}
                    className="group max-w-[46%] cursor-zoom-in rounded-xl bg-white p-2 shadow-sm ring-1 ring-border/50 transition-transform duration-300 ease-out hover:scale-105 sm:p-3"
                  >
                    <img
                      src={src}
                      alt={`${product.name} — vue ${i + 1}`}
                      className="block max-h-36 w-full object-contain sm:max-h-40"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center">
                <div
                  className="group cursor-zoom-in rounded-xl bg-white p-3 shadow-sm ring-1 ring-border/50 transition-transform duration-300 ease-out hover:scale-105 sm:p-4"
                >
                  <img
                    src={images[0]}
                    alt={product.name}
                    className="block max-h-44 w-auto max-w-[min(100%,300px)] object-contain sm:max-h-48"
                  />
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-muted/50">
              <Package className="h-12 w-12" />
              <span className="text-sm">Photo non disponible</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink-soft">
            <Box className="h-4 w-4 text-brand" />
            {product.references?.length || 0} référence
            {(product.references?.length || 0) !== 1 ? 's' : ''} disponible
            {(product.references?.length || 0) !== 1 ? 's' : ''}
          </div>
          {heroPriceRef && (
            <div className="pt-1">
              {(product.references?.length || 0) > 1 && !isQuotePrice(heroPriceRef) && (
                <p className="mb-1 text-xs font-medium text-muted">À partir de</p>
              )}
              <PriceDisplay ref={heroPriceRef} layout="stacked" size="xl" />
            </div>
          )}
          {product.description?.trim() && (
            <p className="text-sm leading-relaxed text-muted">{product.description.trim()}</p>
          )}
        </div>

        <div className="min-w-0 w-full">
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-ink">Références & tarifs</h2>
            <p className="mt-1 text-sm text-muted">
              Sélectionnez les quantités puis ajoutez au panier
            </p>
          </div>

          {hasQuoteRefs && (
            <div className="mb-4 rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span className="font-semibold">{QUOTE_PRICE_TITLE}</span>
              <span className="mx-1.5">—</span>
              {QUOTE_PRICE_HINT}
              <span className="mt-1 block text-xs text-amber-900/80">
                Articles au cours du marché (ex. cuivre) : le tarif est communiqué sur demande.
              </span>
              <Link to="/contact" className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">
                Demander un devis →
              </Link>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[780px] text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-[11px]">
                    <th className="px-2 py-2.5 sm:px-3 sm:py-3">Désignation</th>
                    <th className="px-2 py-2.5 sm:px-3 sm:py-3">Dimensions</th>
                    <th className="px-2 py-2.5 sm:px-3 sm:py-3">Réf. Pro</th>
                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3 sm:py-3">Code AFE</th>
                    <th className="whitespace-nowrap px-2 py-2.5 sm:px-3 sm:py-3">Code cat.</th>
                    <th className="px-2 py-2.5 sm:px-3 sm:py-3">Prix HT</th>
                    <th className="px-1.5 py-2.5 sm:py-3">Cond.</th>
                    <th className="px-1.5 py-2.5 sm:py-3">Qté</th>
                    <th className="px-2 py-2.5 sm:px-3 sm:py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(product.references || []).map((r, idx) => {
                    const quote = isQuotePrice(r);
                    return (
                    <tr
                      key={r.id}
                      className={`border-b border-border/60 transition hover:bg-brand-soft/30 ${
                        idx % 2 === 1 ? 'bg-surface/40' : ''
                      }`}
                    >
                      <td className="px-2 py-2.5 font-medium leading-snug text-ink break-words sm:px-3 sm:py-3">
                        {r.variant_label || r.diameter || '—'}
                      </td>
                      <td className="px-2 py-2.5 text-muted break-words sm:px-3 sm:py-3">{r.diameter || '—'}</td>
                      <td className="px-2 py-2.5 text-muted break-words sm:px-3 sm:py-3">{r.ref_pro || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-[10px] font-semibold text-brand sm:px-3 sm:py-3 sm:text-xs">
                        {r.code}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-[10px] text-muted sm:px-3 sm:py-3 sm:text-xs">
                        {r.supplier_code || '—'}
                      </td>
                    <td className="px-2 py-2.5 sm:px-3 sm:py-3">
                      {quote ? (
                        <PriceDisplay ref={r} size="sm" />
                      ) : (
                        <PriceDisplay ref={r} cdfOnly size="sm" />
                      )}
                      {!quote && r.price_source === 'offer' && r.offer_label && (
                        <span className="mt-1 inline-block rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          {r.offer_label}
                        </span>
                      )}
                    </td>
                      <td className="px-1.5 py-2.5 text-center text-muted sm:py-3">×{r.vendu_par || '1'}</td>
                      <td className="px-1.5 py-2.5 pr-3 sm:py-3">
                        {quote ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
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
                        )}
                      </td>
                      <td className="px-2 py-2.5 pl-3 text-right sm:px-3 sm:py-3">
                        {quote ? (
                          <Link
                            to="/contact"
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-brand/30 px-2.5 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft"
                          >
                            Devis
                          </Link>
                        ) : (
                        <button
                          type="button"
                          onClick={() => addOne(r)}
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            (qtys[r.code] || 0) > 0
                              ? 'bg-brand text-white shadow-sm hover:bg-brand-dark'
                              : 'border border-border text-muted hover:border-brand hover:text-brand'
                          }`}
                        >
                          <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                          Ajouter
                        </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-white/95 shadow-[0_-8px_30px_rgb(15_23_42_/0.08)] backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6">
          {addedNotice && count > 0 && (
            <p className="mb-3 text-center text-sm font-medium text-brand sm:text-left">
              Article ajouté au panier.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-muted">Sélection en cours : </span>
              <span className="inline-flex flex-wrap items-baseline gap-x-1.5 font-semibold text-ink">
                <span>
                  {pendingTotal.count} article{pendingTotal.count !== 1 ? 's' : ''} ·{' '}
                  {formatCdf(pendingTotal.sumCdf)}
                </span>
                {pendingTotal.sumUsd > 0 && (
                  <span className="text-[11px] font-medium text-muted">
                    {formatUsd(pendingTotal.sumUsd)}
                  </span>
                )}
              </span>
              {count > 0 && (
                <span className="ml-3 inline-flex flex-wrap items-baseline gap-x-1 text-xs text-muted">
                  <span>(panier : {count} · {formatCdf(total_cdf)}</span>
                  {total_usd > 0 && (
                    <span className="text-[10px]">{formatUsd(total_usd)}</span>
                  )}
                  <span>)</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {count > 0 && (
                <>
                  <Link
                    to="/"
                    className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
                  >
                    Continuer mes achats
                  </Link>
                  <Link
                    to="/panier"
                    className="rounded-full border border-brand/30 bg-brand-soft px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand/10"
                  >
                    Voir mon panier
                  </Link>
                </>
              )}
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
      </div>
    </div>
  );
}
