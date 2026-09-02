import { useEffect, useState } from 'react';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api.js';

export default function AdminFamilies() {
  const [families, setFamilies] = useState([]);

  async function load() {
    setFamilies(await api.getFamilies());
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function addFamily() {
    const name = prompt('Nom de la famille');
    if (!name?.trim()) return;
    await api.createFamily({ name: name.trim() });
    await load();
  }

  async function editFamily(f) {
    const name = prompt('Nom de la famille', f.name);
    if (!name?.trim()) return;
    await api.updateFamily(f.id, { name: name.trim() });
    await load();
  }

  async function removeFamily(f) {
    if (!confirm(`Supprimer la famille « ${f.name} » et ses sous-familles ?`)) return;
    await api.deleteFamily(f.id);
    await load();
  }

  async function addCategory(f) {
    const name = prompt('Nom de la sous-famille');
    if (!name?.trim()) return;
    await api.createCategory(f.id, { name: name.trim() });
    await load();
  }

  async function editCategory(c) {
    const name = prompt('Nom de la sous-famille', c.name);
    if (!name?.trim()) return;
    await api.updateCategory(c.id, { name: name.trim() });
    await load();
  }

  async function removeCategory(c) {
    if (!confirm(`Supprimer « ${c.name} » ?`)) return;
    await api.deleteCategory(c.id);
    await load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{families.length} famille(s)</p>
        <button
          type="button"
          onClick={addFamily}
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + Nouvelle famille
        </button>
      </div>

      <div className="space-y-3">
        {families.map((f) => (
          <div key={f.id} className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2.5">
              <Layers className="h-4 w-4 text-muted" />
              <span className="flex-1 font-semibold">{f.name}</span>
              <button
                type="button"
                onClick={() => editFamily(f)}
                className="rounded border border-border p-1.5 text-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeFamily(f)}
                className="rounded border border-border p-1.5 text-muted hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => addCategory(f)}
                className="rounded border border-border px-2 py-1 text-xs font-semibold text-ink"
              >
                + Sous-famille
              </button>
            </div>
            {(f.categories || []).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 border-t border-border px-3 py-2 pl-8"
              >
                <span className="mr-2 text-muted">—</span>
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs text-muted">{c.product_count ?? 0}</span>
                <button
                  type="button"
                  onClick={() => editCategory(c)}
                  className="rounded border border-border p-1.5 text-muted"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeCategory(c)}
                  className="rounded border border-border p-1.5 text-muted hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
