import { useEffect, useState } from 'react';
import { Percent, Plus, Trash2, RefreshCw, Tag, Save } from 'lucide-react';
import { api } from '../../api.js';

const EXCEPTION_TYPES = [
  { value: 'manual_price', label: 'Prix fixe manuel' },
  { value: 'margin_override', label: 'Marge spécifique (%)' },
  { value: 'offer', label: 'Offre promotionnelle' },
];

const emptyMargin = {
  family_id: '',
  category_id: '',
  brand: '',
  margin_percent: '20',
  fixed_markup: '0',
  priority: '10',
  label: '',
  active: true,
};

const emptyException = {
  code: '',
  exception_type: 'manual_price',
  price_sale_ht: '',
  margin_percent: '',
  fixed_markup: '0',
  offer_price_ht: '',
  offer_label: '',
  offer_ends_at: '',
  notes: '',
  active: true,
};

export default function AdminMargins() {
  const [families, setFamilies] = useState([]);
  const [marginRules, setMarginRules] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [marginForm, setMarginForm] = useState(emptyMargin);
  const [exceptionForm, setExceptionForm] = useState(emptyException);
  const [recalcResult, setRecalcResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [f, m, e] = await Promise.all([
      api.getFamilies({ all: true }),
      api.getMarginRules(),
      api.getPriceExceptions(),
    ]);
    setFamilies(f);
    setMarginRules(m);
    setExceptions(e);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const categories = families.flatMap((fam) =>
    (fam.categories || []).map((c) => ({ ...c, family_id: fam.id, family_name: fam.name }))
  );

  async function saveMargin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createMarginRule({
        ...marginForm,
        family_id: marginForm.family_id || null,
        category_id: marginForm.category_id || null,
        margin_percent: Number(marginForm.margin_percent),
        fixed_markup: Number(marginForm.fixed_markup),
        priority: Number(marginForm.priority),
      });
      setMarginForm(emptyMargin);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveException(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createPriceException({
        ...exceptionForm,
        price_sale_ht: exceptionForm.price_sale_ht === '' ? null : Number(exceptionForm.price_sale_ht),
        margin_percent: exceptionForm.margin_percent === '' ? null : Number(exceptionForm.margin_percent),
        fixed_markup: Number(exceptionForm.fixed_markup || 0),
        offer_price_ht: exceptionForm.offer_price_ht === '' ? null : Number(exceptionForm.offer_price_ht),
        offer_ends_at: exceptionForm.offer_ends_at || null,
      });
      setExceptionForm(emptyException);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function recalculate() {
    if (!confirm('Recalculer tous les prix de vente (hors prix manuels et exceptions) ?')) return;
    setBusy(true);
    try {
      const res = await api.recalculatePrices();
      setRecalcResult(res);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMargin(id) {
    if (!confirm('Supprimer cette règle de marge ?')) return;
    await api.deleteMarginRule(id);
    await load();
  }

  async function removeException(id) {
    if (!confirm('Supprimer cette exception ?')) return;
    await api.deletePriceException(id);
    await load();
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10';

  return (
    <div className="space-y-8">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink">
              <Percent className="h-5 w-5 text-brand" />
              Marges par famille
            </h2>
            <p className="mt-1 text-sm text-muted">
              Le prix catalogue (import CEDEO) n’est jamais écrasé. Seul le prix de vente est
              recalculé à partir de ces règles.
            </p>
          </div>
          <button
            type="button"
            onClick={recalculate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Recalculer les prix
          </button>
        </div>

        {recalcResult && (
          <div className="mt-4 rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand-dark">
            {recalcResult.updated} prix mis à jour · {recalcResult.skipped} ignorés (manuel /
            exception)
          </div>
        )}

        <form onSubmit={saveMargin} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="font-medium">Famille</span>
            <select
              className={`${inputClass} mt-1`}
              value={marginForm.family_id}
              onChange={(e) =>
                setMarginForm({ ...marginForm, family_id: e.target.value, category_id: '' })
              }
            >
              <option value="">Toutes (défaut)</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Sous-famille</span>
            <select
              className={`${inputClass} mt-1`}
              value={marginForm.category_id}
              onChange={(e) => setMarginForm({ ...marginForm, category_id: e.target.value })}
            >
              <option value="">—</option>
              {categories
                .filter((c) => !marginForm.family_id || String(c.family_id) === marginForm.family_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Marque (optionnel)</span>
            <input
              className={`${inputClass} mt-1`}
              value={marginForm.brand}
              onChange={(e) => setMarginForm({ ...marginForm, brand: e.target.value })}
              placeholder="Altech, Geberit…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Marge %</span>
            <input
              type="number"
              step="0.1"
              className={`${inputClass} mt-1`}
              value={marginForm.margin_percent}
              onChange={(e) => setMarginForm({ ...marginForm, margin_percent: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Majoration fixe €</span>
            <input
              type="number"
              step="0.01"
              className={`${inputClass} mt-1`}
              value={marginForm.fixed_markup}
              onChange={(e) => setMarginForm({ ...marginForm, fixed_markup: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Libellé</span>
            <input
              className={`${inputClass} mt-1`}
              value={marginForm.label}
              onChange={(e) => setMarginForm({ ...marginForm, label: e.target.value })}
              placeholder="Ex. Plomberie standard"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-soft"
            >
              <Plus className="h-4 w-4" />
              Ajouter règle
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Portée</th>
                <th className="px-3 py-2">Marge</th>
                <th className="px-3 py-2">Fixe</th>
                <th className="px-3 py-2">Priorité</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {marginRules.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5">
                    {[r.family_name, r.category_name, r.brand].filter(Boolean).join(' · ') ||
                      'Défaut global'}
                    {r.label && <span className="ml-2 text-xs text-muted">({r.label})</span>}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-brand">{r.margin_percent} %</td>
                  <td className="px-3 py-2.5">{Number(r.fixed_markup) || 0} €</td>
                  <td className="px-3 py-2.5 text-muted">{r.priority}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => removeMargin(r.id)}
                      className="text-muted hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {marginRules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    Aucune règle — ajoutez une marge par famille.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink">
          <Tag className="h-5 w-5 text-accent" />
          Exceptions & offres (par code produit)
        </h2>
        <p className="mt-1 text-sm text-muted">
          Prix fixe, marge spécifique ou offre promo — jamais écrasés par un réimport catalogue.
        </p>

        <form onSubmit={saveException} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">Code CEDEO *</span>
            <input
              className={`${inputClass} mt-1 font-mono`}
              value={exceptionForm.code}
              onChange={(e) => setExceptionForm({ ...exceptionForm, code: e.target.value })}
              placeholder="7350142"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Type</span>
            <select
              className={`${inputClass} mt-1`}
              value={exceptionForm.exception_type}
              onChange={(e) =>
                setExceptionForm({ ...exceptionForm, exception_type: e.target.value })
              }
            >
              {EXCEPTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {exceptionForm.exception_type === 'manual_price' && (
            <label className="block text-sm">
              <span className="font-medium">Prix vente HT €</span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} mt-1`}
                value={exceptionForm.price_sale_ht}
                onChange={(e) =>
                  setExceptionForm({ ...exceptionForm, price_sale_ht: e.target.value })
                }
              />
            </label>
          )}
          {exceptionForm.exception_type === 'margin_override' && (
            <label className="block text-sm">
              <span className="font-medium">Marge %</span>
              <input
                type="number"
                step="0.1"
                className={`${inputClass} mt-1`}
                value={exceptionForm.margin_percent}
                onChange={(e) =>
                  setExceptionForm({ ...exceptionForm, margin_percent: e.target.value })
                }
              />
            </label>
          )}
          {exceptionForm.exception_type === 'offer' && (
            <>
              <label className="block text-sm">
                <span className="font-medium">Prix offre HT €</span>
                <input
                  type="number"
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={exceptionForm.offer_price_ht}
                  onChange={(e) =>
                    setExceptionForm({ ...exceptionForm, offer_price_ht: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Libellé offre</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={exceptionForm.offer_label}
                  onChange={(e) =>
                    setExceptionForm({ ...exceptionForm, offer_label: e.target.value })
                  }
                  placeholder="Promo été"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Fin offre</span>
                <input
                  type="datetime-local"
                  className={`${inputClass} mt-1`}
                  value={exceptionForm.offer_ends_at}
                  onChange={(e) =>
                    setExceptionForm({ ...exceptionForm, offer_ends_at: e.target.value })
                  }
                />
              </label>
            </>
          )}
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium">Notes</span>
            <input
              className={`${inputClass} mt-1`}
              value={exceptionForm.notes}
              onChange={(e) => setExceptionForm({ ...exceptionForm, notes: e.target.value })}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              Enregistrer exception
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Valeur</th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {exceptions.map((ex) => (
                <tr key={ex.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5 font-mono text-xs">{ex.code}</td>
                  <td className="px-3 py-2.5">{ex.exception_type}</td>
                  <td className="px-3 py-2.5 font-semibold">
                    {ex.exception_type === 'offer'
                      ? `${ex.offer_price_ht} €${ex.offer_label ? ` (${ex.offer_label})` : ''}`
                      : ex.exception_type === 'margin_override'
                        ? `${ex.margin_percent} %`
                        : `${ex.price_sale_ht} €`}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{ex.product_name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => removeException(ex.id)}
                      className="text-muted hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {exceptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    Aucune exception pour l’instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
