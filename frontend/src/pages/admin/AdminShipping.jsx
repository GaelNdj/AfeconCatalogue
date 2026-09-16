import { useEffect, useState } from 'react';
import { Truck, Plus, Trash2, Save } from 'lucide-react';
import { api, formatPrice } from '../../api.js';

const RULE_TYPES = [
  { value: 'order_total', label: 'Selon montant panier' },
  { value: 'free_threshold', label: 'Franco de port (seuil)' },
  { value: 'flat', label: 'Forfait fixe' },
];

const emptyRule = {
  name: '',
  rule_type: 'order_total',
  min_order_total: '0',
  max_order_total: '',
  fee_ht: '15',
  free_above: '',
  family_id: '',
  priority: '10',
  active: true,
};

export default function AdminShipping() {
  const [families, setFamilies] = useState([]);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyRule);
  const [previewSubtotal, setPreviewSubtotal] = useState('100');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [f, r] = await Promise.all([api.getFamilies({ all: true }), api.getShippingRules()]);
    setFamilies(f);
    setRules(r);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createShippingRule({
        ...form,
        min_order_total: form.min_order_total === '' ? null : Number(form.min_order_total),
        max_order_total: form.max_order_total === '' ? null : Number(form.max_order_total),
        fee_ht: Number(form.fee_ht),
        free_above: form.free_above === '' ? null : Number(form.free_above),
        family_id: form.family_id || null,
        priority: Number(form.priority),
      });
      setForm(emptyRule);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm('Supprimer cette règle de livraison ?')) return;
    await api.deleteShippingRule(id);
    await load();
  }

  async function runPreview() {
    const res = await api.calculateShipping({
      subtotal_ht: Number(previewSubtotal) || 0,
    });
    setPreview(res);
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10';

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-ink">
          <Truck className="h-5 w-5 text-brand" />
          Frais de livraison
        </h2>
        <p className="mt-1 text-sm text-muted">
          Définissez des forfaits ou des seuils de franco de port. Calculés automatiquement au
          panier.
        </p>

        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">Nom *</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Standard France"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Type</span>
            <select
              className={`${inputClass} mt-1`}
              value={form.rule_type}
              onChange={(e) => setForm({ ...form, rule_type: e.target.value })}
            >
              {RULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {form.rule_type === 'order_total' && (
            <>
              <label className="block text-sm">
                <span className="font-medium">Panier min € HT</span>
                <input
                  type="number"
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={form.min_order_total}
                  onChange={(e) => setForm({ ...form, min_order_total: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Panier max € HT</span>
                <input
                  type="number"
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={form.max_order_total}
                  onChange={(e) => setForm({ ...form, max_order_total: e.target.value })}
                  placeholder="Illimité"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Frais € HT</span>
                <input
                  type="number"
                  step="0.01"
                  className={`${inputClass} mt-1`}
                  value={form.fee_ht}
                  onChange={(e) => setForm({ ...form, fee_ht: e.target.value })}
                />
              </label>
            </>
          )}
          {form.rule_type === 'free_threshold' && (
            <label className="block text-sm">
              <span className="font-medium">Franco à partir de € HT</span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} mt-1`}
                value={form.free_above}
                onChange={(e) => setForm({ ...form, free_above: e.target.value })}
                placeholder="150"
              />
            </label>
          )}
          {form.rule_type === 'flat' && (
            <label className="block text-sm">
              <span className="font-medium">Forfait € HT</span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} mt-1`}
                value={form.fee_ht}
                onChange={(e) => setForm({ ...form, fee_ht: e.target.value })}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium">Famille (optionnel)</span>
            <select
              className={`${inputClass} mt-1`}
              value={form.family_id}
              onChange={(e) => setForm({ ...form, family_id: e.target.value })}
            >
              <option value="">Toutes</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
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
                <th className="px-3 py-2">Nom</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Conditions</th>
                <th className="px-3 py-2">Frais</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5 font-medium">{r.name}</td>
                  <td className="px-3 py-2.5 text-muted">{r.rule_type}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {r.rule_type === 'free_threshold'
                      ? `≥ ${r.free_above} €`
                      : r.rule_type === 'flat'
                        ? 'Forfait'
                        : `${r.min_order_total ?? 0} – ${r.max_order_total ?? '∞'} €`}
                    {r.family_name ? ` · ${r.family_name}` : ''}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{formatPrice(r.fee_ht)}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="text-muted hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    Aucune règle de livraison — ajoutez-en une ci-dessus.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink">Simulateur panier</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Sous-total HT €
            <input
              type="number"
              className={`${inputClass} mt-1 w-32`}
              value={previewSubtotal}
              onChange={(e) => setPreviewSubtotal(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={runPreview}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Calculer livraison
          </button>
          {preview && (
            <span className="text-sm">
              →{' '}
              {preview.free_shipping ? (
                <strong className="text-brand">Franco de port</strong>
              ) : (
                <>
                  Frais : <strong>{formatPrice(preview.fee_ht)}</strong>
                  {preview.rule_name && (
                    <span className="text-muted"> ({preview.rule_name})</span>
                  )}
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
