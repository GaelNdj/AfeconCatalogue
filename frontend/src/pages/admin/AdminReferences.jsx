import { useEffect, useState } from 'react';
import { Pencil, Trash2, Save } from 'lucide-react';
import { api, formatPrice } from '../../api.js';

const emptyRef = {
  code: '',
  variant_label: '',
  diameter: '',
  ref_pro: '',
  ref_four: '',
  price_catalog_ht: '',
  price_sale_cdf: '',
  vendu_par: '1',
  stock: 0,
  weight: '',
};

export default function AdminReferences() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [refs, setRefs] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyRef);

  async function loadProducts() {
    const p = await api.getProducts({ limit: 100 });
    setProducts(p.items);
    if (!selectedId && p.items[0]) setSelectedId(p.items[0].id);
  }

  async function loadRefs(pid) {
    if (!pid) return;
    const r = await api.getReferences({ product_id: pid, limit: 200 });
    setRefs(r.items);
  }

  useEffect(() => {
    loadProducts().catch(console.error);
  }, []);

  useEffect(() => {
    loadRefs(selectedId).catch(console.error);
  }, [selectedId]);

  const selected = products.find((p) => p.id === selectedId);

  function openCreate() {
    setForm(emptyRef);
    setModal('create');
  }

  function openEdit(r) {
    setForm({
      code: r.code || '',
      variant_label: r.variant_label || '',
      diameter: r.diameter || '',
      ref_pro: r.ref_pro || '',
      ref_four: r.ref_four || '',
      price_catalog_ht: r.price_catalog_ht ?? r.price_ht ?? '',
      price_sale_cdf: r.price_sale_cdf ?? '',
      vendu_par: r.vendu_par || '1',
      stock: r.stock ?? 0,
      weight: r.weight ?? '',
    });
    setModal(r);
  }

  async function save() {
    try {
      const price =
        form.price_catalog_ht === '' ? null : Number(form.price_catalog_ht);
      const cdf =
        form.price_sale_cdf === '' ? null : Number(form.price_sale_cdf);
      const body = {
        code: form.code,
        product_id: selectedId,
        variant_label: form.variant_label.trim() || null,
        diameter: form.diameter || null,
        ref_pro: form.ref_pro || null,
        ref_four: form.ref_four || null,
        price_catalog_ht: Number.isFinite(price) ? price : null,
        price_sale_cdf: Number.isFinite(cdf) ? cdf : null,
        price_is_manual_cdf: Number.isFinite(cdf),
        vendu_par: form.vendu_par || '1',
        stock: Number(form.stock) || 0,
        weight: form.weight === '' ? null : Number(form.weight),
      };
      if (modal === 'create') await api.createReference(body);
      else await api.updateReference(modal.id, body);
      setModal(null);
      await loadRefs(selectedId);
    } catch (e) {
      alert(e.message);
    }
  }

  async function remove(r) {
    if (!confirm(`Supprimer la référence ${r.code} ?`)) return;
    await api.deleteReference(r.id);
    await loadRefs(selectedId);
  }

  return (
    <div className="flex gap-4">
      <aside className="w-56 shrink-0 overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Produits
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`block w-full truncate px-3 py-2 text-left text-sm ${
                selectedId === p.id
                  ? 'bg-brand-soft font-semibold text-brand'
                  : 'hover:bg-gray-50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold">{selected?.name || '—'}</h2>
            <p className="text-sm text-muted">{refs.length} référence(s)</p>
          </div>
          <button
            type="button"
            disabled={!selectedId}
            onClick={openCreate}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            + Ajouter une référence
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-gray-50 text-left text-[10px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Désignation</th>
                <th className="px-3 py-2">Dimensions</th>
                <th className="px-3 py-2">Réf. interne</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Prix cat. HT</th>
                <th className="px-3 py-2">Cond.</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Poids</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {refs.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{r.variant_label || '—'}</td>
                  <td className="px-3 py-2 font-semibold">{r.diameter || '—'}</td>
                  <td className="px-3 py-2 text-muted">{r.ref_pro || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2 font-semibold">
                    {formatPrice(r.price_catalog_ht ?? r.price_ht)}
                  </td>
                  <td className="px-3 py-2 text-muted">×{r.vendu_par || '1'}</td>
                  <td className="px-3 py-2">{r.stock ?? 0}</td>
                  <td className="px-3 py-2 text-muted">
                    {r.weight != null ? `${r.weight} kg` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded border border-border p-1.5 text-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r)}
                        className="rounded border border-border p-1.5 text-muted hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-bold">
                {modal === 'create' ? 'Nouvelle référence' : 'Modifier la référence'}
              </h2>
              <button type="button" onClick={() => setModal(null)} className="text-xl text-muted">
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              {[
                ['code', 'Code *'],
                ['variant_label', 'Désignation variante'],
                ['diameter', 'Dimensions'],
                ['ref_pro', 'Réf. interne'],
                ['ref_four', 'Réf. four.'],
                ['price_catalog_ht', 'Prix catalogue € HT'],
                ['price_sale_cdf', 'Prix fixe CDF (vente)'],
                ['vendu_par', 'Cond.'],
                ['stock', 'Stock'],
                ['weight', 'Poids'],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {label}
                  </span>
                  <input
                    className="mt-1 w-full rounded border border-border px-2 py-1.5 font-mono text-sm"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </label>
              ))}
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
                onClick={save}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"
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
