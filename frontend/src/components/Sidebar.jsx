import {
  Layers,
  Droplets,
  Zap,
  Flame,
  Hammer,
  LayoutGrid,
  Package,
} from 'lucide-react';

const FAMILY_ICONS = {
  Plomberie: Droplets,
  Électricité: Zap,
  Electricite: Zap,
  Chauffage: Flame,
  Outillage: Hammer,
  Sanitaire: Droplets,
  'Génie climatique': Flame,
  Revêtements: LayoutGrid,
};

function FamilyIcon({ name }) {
  const Icon = FAMILY_ICONS[name] || Package;
  return <Icon className="h-4 w-4 shrink-0" />;
}

export default function Sidebar({ families, selectedFamilyId, onSelect, totalProducts }) {
  return (
    <aside className="w-full shrink-0 lg:w-64">
      <div className="card sticky top-[5.5rem] overflow-hidden">
        <div className="border-b border-border bg-gradient-to-r from-brand-soft to-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
            <Layers className="h-4 w-4" />
            Familles
          </div>
          <p className="mt-0.5 text-xs text-muted">Filtrer le catalogue</p>
        </div>
        <nav className="p-2">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
              !selectedFamilyId
                ? 'bg-brand font-semibold text-white shadow-sm'
                : 'text-ink-soft hover:bg-surface'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LayoutGrid className="h-4 w-4 opacity-80" />
              Tout le catalogue
            </span>
            {totalProducts != null && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  !selectedFamilyId ? 'bg-white/20 text-white' : 'bg-surface text-muted'
                }`}
              >
                {totalProducts}
              </span>
            )}
          </button>
          <div className="my-2 h-px bg-border" />
          {families.map((f) => {
            const active = selectedFamilyId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f.id)}
                className={`mb-0.5 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? 'bg-brand-soft font-semibold text-brand-dark ring-1 ring-brand/20'
                    : 'text-ink-soft hover:bg-surface'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-md ${
                      active ? 'bg-brand/10 text-brand' : 'bg-surface text-muted'
                    }`}
                  >
                    <FamilyIcon name={f.name} />
                  </span>
                  {f.name}
                </span>
                <span className="text-xs text-muted">{f.product_count ?? 0}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
