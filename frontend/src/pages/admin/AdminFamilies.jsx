import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Layers, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api.js';

export default function AdminFamilies() {
  const [families, setFamilies] = useState([]);
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  async function load() {
    setFamilies(await api.getFamilies({ all: true }));
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

  async function toggleFamilyVisible(f) {
    await api.updateFamily(f.id, { visible: f.visible === false });
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

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(families.map((f) => f.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {families.length} famille(s) — l’œil affiche ou masque la famille sur le catalogue, sans la
            supprimer.
          </p>
          <div className="mt-1 flex gap-2 text-xs">
            <button
              type="button"
              onClick={expandAll}
              className="font-medium text-brand hover:underline"
            >
              Tout déplier
            </button>
            <span className="text-muted">·</span>
            <button
              type="button"
              onClick={collapseAll}
              className="font-medium text-brand hover:underline"
            >
              Tout replier
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={addFamily}
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + Nouvelle famille
        </button>
      </div>

      <div className="space-y-3">
        {families.map((f) => {
          const subCount = (f.categories || []).length;
          const expanded = expandedIds.has(f.id);
          return (
          <div key={f.id} className="overflow-hidden rounded-lg border border-border">
            <div className={`flex items-center gap-2 px-3 py-2.5 ${f.visible === false ? 'bg-gray-50/80' : 'bg-gray-50'}`}>
              {subCount > 0 ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(f.id)}
                  title={expanded ? 'Replier les sous-familles' : 'Déplier les sous-familles'}
                  className="rounded p-0.5 text-muted hover:bg-white hover:text-brand"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="w-5" aria-hidden />
              )}
              <Layers className="h-4 w-4 shrink-0 text-muted" />
              <button
                type="button"
                onClick={() => subCount > 0 && toggleExpanded(f.id)}
                className={`flex-1 text-left font-semibold ${f.visible === false ? 'text-muted' : ''} ${subCount > 0 ? 'hover:text-brand' : ''}`}
              >
                {f.name}
                {subCount > 0 && !expanded && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    ({subCount} sous-famille{subCount > 1 ? 's' : ''})
                  </span>
                )}
              </button>
              {f.visible === false && (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-muted">
                  Masquée
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleFamilyVisible(f)}
                title={f.visible === false ? 'Afficher sur le catalogue' : 'Masquer du catalogue'}
                className="rounded border border-border p-1.5 text-muted hover:text-brand"
              >
                {f.visible === false ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
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
            {expanded &&
              (f.categories || []).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 border-t border-border px-3 py-2 pl-11"
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
          );
        })}
      </div>
    </div>
  );
}
