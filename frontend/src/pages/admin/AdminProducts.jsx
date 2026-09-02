import { useEffect, useState } from 'react';
import { Pencil, Trash2, Package, Save } from 'lucide-react';
import { api, imageUrl } from '../../api.js';

const emptyForm = {
  name: '',
  brand: '',
  description: '',
  image_path: '',
  family_id: '',
  category_id: '',
};

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [families, setFamilies] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.getFamilies().then(setFamilies).catch(console.error);
  }, []);

  useEffect(() => {
    api
      .getProducts({ limit: 50, page, ...(search ? { q: search } : {}) })
      .then((pRes) => {
        setProducts(pRes.items);
        setMeta({ total: pRes.total, page: pRes.page, totalPages: pRes.totalPages });
      })
      .catch(console.error);
  }, [page, search]);

  async function reload() {
    const pRes = await api.getProducts({
      limit: 50,
      page,
      ...(search ? { q: search } : {}),
    });
    setProducts(pRes.items);
    setMeta({ total: pRes.total, page: pRes.page, totalPages: pRes.totalPages });
  }

  const categories = families.flatMap((f) =>
    (f.categories || []).map((c) => ({ ...c, family_id: f.id, family_name: f.name }))
  );

  function openCreate() {
    setForm(emptyForm);
    setModal('create');
  }

  function openEdit(p) {
    setForm({
      name: p.name || '',
      brand: p.brand || '',
      description: p.description || '',
      image_path: p.image_path || '',
      family_id: p.family_id || '',
      category_id: p.category_id || '',
    });
    setModal(p);
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        ...form,
        family_id: form.family_id || null,
        category_id: form.category_id || null,
      };
      if (modal === 'create') await api.createProduct(body);
      else await api.updateProduct(modal.id, body);
      setModal(null);
      await reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p) {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    await api.deleteProduct(p.id);
    await reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            {meta.total} produit{meta.total !== 1 ? 's' : ''}
            {search ? ` · recherche « ${search} »` : ''}
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(q.trim());
            }}
          >
            <input
              className="rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
              placeholder="Rechercher…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
            >
              OK
            </button>
          </form>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          + Nouveau produit
        </button>
      </div>

      <div className="card overflow-hidden divide-y divide-border">
        {products.map((p) => {
          const img = imageUrl(p.display_image || p.image_path);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface/60"
            >
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-surface">
                {img ? (
                  <img src={img} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Package className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-xs text-muted">
                  {[p.brand, p.family_name, p.category_name].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(p)}
                className="rounded border border-border p-1.5 text-muted hover:text-ink"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(p)}
                className="rounded border border-border p-1.5 text-muted hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-sm text-muted">
            Page {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-bold">
                {modal === 'create' ? 'Nouveau produit' : 'Modifier le produit'}
              </h2>
              <button type="button" onClick={() => setModal(null)} className="text-xl text-muted">
                ×
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {[
                ['name', 'Nom *'],
                ['brand', 'Marque'],
                ['description', 'Description courte'],
                ['image_path', 'URL image'],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {label}
                  </span>
                  <input
                    className="mt-1 w-full rounded border border-border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-brand/30"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Famille
                </span>
                <select
                  className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                  value={form.family_id}
                  onChange={(e) =>
                    setForm({ ...form, family_id: e.target.value, category_id: '' })
                  }
                >
                  <option value="">—</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Sous-famille
                </span>
                <select
                  className="mt-1 w-full rounded border border-border px-3 py-2 text-sm"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">—</option>
                  {categories
                    .filter((c) => !form.family_id || String(c.family_id) === String(form.family_id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving || !form.name.trim()}
                onClick={save}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
