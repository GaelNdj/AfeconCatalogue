import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Sidebar from '../components/Sidebar.jsx';
import ProductCard from '../components/ProductCard.jsx';

function ProductSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[5/4] rounded-none" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-5 w-full" />
        <div className="skeleton h-3 w-4/5" />
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const familyId = searchParams.get('family_id');
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [families, setFamilies] = useState([]);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFamilies().then(setFamilies).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 24 };
    if (q) params.q = q;
    if (familyId) params.family_id = familyId;
    api
      .getProducts(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q, familyId, page]);

  function selectFamily(id) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('family_id', id);
    else next.delete('family_id');
    next.delete('page');
    setSearchParams(next);
  }

  function setPage(p) {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setSearchParams(next);
  }

  const selectedFamily = familyId
    ? families.find((f) => String(f.id) === String(familyId))
    : null;

  const title = q
    ? `Résultats pour « ${q} »`
    : selectedFamily?.name || 'Catalogue';

  const subtitle = q
    ? `${data.total} produit${data.total !== 1 ? 's' : ''} trouvé${data.total !== 1 ? 's' : ''}`
    : selectedFamily
      ? `Produits de la famille ${selectedFamily.name.toLowerCase()}`
      : 'Parcourez l’ensemble de nos références professionnelles';

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-brand-dark px-6 py-8 text-white shadow-lg sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-teal-100">
              <Sparkles className="h-4 w-4" />
              AfeconCatalogue
            </p>
            <h1 className="font-display mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-teal-50/90">{subtitle}</p>
          </div>
          {!loading && (
            <div className="rounded-xl bg-white/15 px-4 py-3 text-center backdrop-blur">
              <div className="font-display text-2xl font-bold">{data.total}</div>
              <div className="text-xs text-teal-100">produits</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Sidebar
          families={families}
          selectedFamilyId={familyId ? Number(familyId) : null}
          onSelect={selectFamily}
          totalProducts={data.total}
        />

        <main className="min-w-0 flex-1">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductSkeleton key={i} />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="card flex flex-col items-center px-8 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="font-display text-lg font-bold text-ink">
                {q ? 'Aucun résultat pour cette recherche' : 'Aucun produit pour l’instant'}
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                {q ? (
                  <>
                    Nous n’avons pas trouvé « {q} » dans le catalogue.
                  </>
                ) : (
                  <>
                    Importez votre fichier Excel et vos photos depuis{' '}
                    <span className="font-medium text-brand">Admin → Import</span>, ou lancez le
                    seed démo pour tester l’interface.
                  </>
                )}
              </p>
              {q && (
                <Link
                  to={`/contact?q=${encodeURIComponent(q)}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  <MessageCircle className="h-4 w-4" />
                  Demander cette pièce
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {data.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-brand/30 disabled:opacity-40"
                  >
                    ← Précédent
                  </button>
                  <span className="rounded-full bg-white px-4 py-2 text-sm text-muted shadow-sm">
                    Page {page} sur {data.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-brand/30 disabled:opacity-40"
                  >
                    Suivant →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
