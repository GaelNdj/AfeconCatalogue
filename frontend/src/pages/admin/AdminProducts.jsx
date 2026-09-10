import { useEffect, useState } from 'react';
import { Pencil, Trash2, Package, Save, Plus } from 'lucide-react';
import { api, imageUrl } from '../../api.js';

const emptyForm = {
  name: '',
  brand: '',
  description: '',
  image_path: '',
  family_id: '',
  category_id: '',
};

function emptyRefRow(sortOrder = 0) {
  return {
    id: null,
    code: '',
    variant_label: '',
    diameter: '',
    ref_pro: '',
    ref_four: '',
    price_catalog_ht: '',
    price_sale_cdf: '',
    vendu_par: '1',
    sort_order: sortOrder,
  };
}

function refToRow(r, index) {
  return {
    id: r.id,
    code: r.code || '',
    variant_label: r.variant_label || '',
    diameter: r.diameter || '',
    ref_pro: r.ref_pro || '',
    ref_four: r.ref_four || '',
    price_catalog_ht: r.price_catalog_ht ?? r.price_ht ?? '',
    price_sale_cdf: r.price_sale_cdf ?? '',
    vendu_par: r.vendu_par || '1',
    sort_order: r.sort_order ?? index + 1,
  };
}

function rowToPayload(row, productId) {
  const price =
    row.price_catalog_ht === '' || row.price_catalog_ht == null
      ? null
      : Number(row.price_catalog_ht);
  return {
    product_id: productId,
    code: row.code.trim(),
    variant_label: row.variant_label.trim() || null,
    diameter: row.diameter.trim() || null,
    ref_pro: row.ref_pro.trim() || null,
    ref_four: row.ref_four.trim() || null,
    price_catalog_ht: Number.isFinite(price) ? price : null,
    price_sale_cdf:
      row.price_sale_cdf === '' || row.price_sale_cdf == null
        ? null
        : Number(row.price_sale_cdf),
    price_is_manual_cdf:
      row.price_sale_cdf !== '' &&
      row.price_sale_cdf != null &&
      Number.isFinite(Number(row.price_sale_cdf)),
    vendu_par: row.vendu_par.trim() || '1',
    sort_order: Number(row.sort_order) || null,
  };
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [families, setFamilies] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [refRows, setRefRows] = useState([]);
  const [deletedRefIds, setDeletedRefIds] = useState([]);
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
    setRefRows([]);
    setDeletedRefIds([]);
    setModal('create');
  }

  async function openEdit(p) {
    setForm({
      name: p.name || '',
      brand: p.brand || '',
      description: p.description || '',
      image_path: p.image_path || '',
      family_id: p.family_id || '',
      category_id: p.category_id || '',
    });
    setDeletedRefIds([]);
    try {
      const res = await api.getReferences({ product_id: p.id, limit: 200 });
      setRefRows(res.items.map((r, i) => refToRow(r, i)));
    } catch {
      setRefRows([]);
    }
    setModal(p);
  }

  function closeModal() {
    setModal(null);
    setRefRows([]);
    setDeletedRefIds([]);
  }

  function updateRefRow(index, key, value) {
    setRefRows((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function addRefRow() {
    setRefRows((rows) => [...rows, emptyRefRow(rows.length + 1)]);
  }

  function removeRefRow(index) {
    setRefRows((rows) => {
      const row = rows[index];
      if (row?.id) setDeletedRefIds((ids) => [...ids, row.id]);
      return rows.filter((_, i) => i !== index);
    });
  }

  async function saveReferences(productId) {
    for (const id of deletedRefIds) {
      await api.deleteReference(id);
    }
    for (const row of refRows) {
      if (!row.code.trim()) continue;
      const body = rowToPayload(row, productId);
      if (row.id) await api.updateReference(row.id, body);
      else await api.createReference(body);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        ...form,
        family_id: form.family_id || null,
        category_id: form.category_id || null,
      };
      let productId;
      if (modal === 'create') {
        const created = await api.createProduct(body);
        productId = created.id;
      } else {
        await api.updateProduct(modal.id, body);
        productId = modal.id;
      }
      if (refRows.length > 0 || deletedRefIds.length > 0) {
        await saveReferences(productId);
      }
      closeModal();
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

  const isEdit = modal && modal !== 'create';

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
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
              onClick={() => {
                setPage(1);
                setSearch(q.trim());
              }}
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
                  {[p.brand, p.family_name, p.category_name, p.ref_count ? `${p.ref_count} ref.` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(p)}
                className="rounded border border-border p-1.5 text-muted hover:text-ink"
                title="Modifier le produit et ses références"
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
          <div className="card flex max-h-[92vh] w-full max-w-5xl flex-col shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-bold">
                {modal === 'create' ? 'Nouveau produit' : 'Modifier le produit'}
              </h2>
              <button type="button" onClick={closeModal} className="text-xl text-muted">
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
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
                      className="mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30"
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

              {(isEdit || modal === 'create' || refRows.length > 0) && (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-ink">Références & variantes</h3>
                      <p className="text-xs text-muted">
                        Corrigez les désignations, ajoutez une ligne manquante ou complétez les prix.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addRefRow}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter une ligne
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[880px] text-xs">
                      <thead className="bg-surface text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-2 py-2">Désignation</th>
                          <th className="px-2 py-2">Dimensions</th>
                          <th className="px-2 py-2">Réf. Pro</th>
                          <th className="px-2 py-2">Réf. four.</th>
                          <th className="px-2 py-2">Code</th>
                          <th className="px-2 py-2">Prix cat. €</th>
                          <th className="px-2 py-2">Prix fixe CDF</th>
                          <th className="px-2 py-2">Cond.</th>
                          <th className="px-2 py-2 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {refRows.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-3 py-4 text-center text-muted">
                              Aucune référence — cliquez sur « Ajouter une ligne »
                            </td>
                          </tr>
                        )}
                        {refRows.map((row, index) => (
                          <tr key={row.id || `new-${index}`} className="border-t border-border">
                            <td className="px-2 py-1.5">
                              <input
                                className="w-full min-w-[120px] rounded border border-border px-2 py-1"
                                placeholder="ex. L.300 mm"
                                value={row.variant_label}
                                onChange={(e) => updateRefRow(index, 'variant_label', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className="w-full min-w-[80px] rounded border border-border px-2 py-1"
                                value={row.diameter}
                                onChange={(e) => updateRefRow(index, 'diameter', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className="w-full min-w-[70px] rounded border border-border px-2 py-1 font-mono"
                                value={row.ref_pro}
                                onChange={(e) => updateRefRow(index, 'ref_pro', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className="w-full min-w-[70px] rounded border border-border px-2 py-1 font-mono"
                                value={row.ref_four}
                                onChange={(e) => updateRefRow(index, 'ref_four', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className="w-full min-w-[80px] rounded border border-border px-2 py-1 font-mono"
                                value={row.code}
                                onChange={(e) => updateRefRow(index, 'code', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="0.01"
                                className="w-full min-w-[72px] rounded border border-border px-2 py-1 font-mono"
                                value={row.price_catalog_ht}
                                onChange={(e) =>
                                  updateRefRow(index, 'price_catalog_ht', e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step="1"
                                placeholder="optionnel"
                                title="Prix vente fixe en francs congolais (prioritaire sur la conversion)"
                                className="w-full min-w-[80px] rounded border border-border px-2 py-1 font-mono"
                                value={row.price_sale_cdf}
                                onChange={(e) =>
                                  updateRefRow(index, 'price_sale_cdf', e.target.value)
                                }
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                className="w-14 rounded border border-border px-2 py-1 font-mono"
                                value={row.vendu_par}
                                onChange={(e) => updateRefRow(index, 'vendu_par', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => removeRefRow(index)}
                                className="rounded border border-border p-1 text-muted hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={closeModal}
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
