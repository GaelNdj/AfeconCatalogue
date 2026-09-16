import { NavLink, Outlet, Link } from 'react-router-dom';
import { Box, GitBranch, Layers, Upload, Percent, Truck, ShoppingBag, ArrowLeft, LogOut } from 'lucide-react';
import AdminGate from '../../components/AdminGate.jsx';
import { clearAdminKey } from '../../api.js';

const tabs = [
  { to: '/admin', end: true, label: 'Produits', icon: Box },
  { to: '/admin/references', label: 'Références', icon: GitBranch },
  { to: '/admin/familles', label: 'Familles', icon: Layers },
  { to: '/admin/marges', label: 'Marges', icon: Percent },
  { to: '/admin/livraison', label: 'Livraison', icon: Truck },
  { to: '/admin/import', label: 'Import', icon: Upload },
  { to: '/admin/commandes', label: 'Commandes', icon: ShoppingBag },
];

export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition hover:text-brand"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au catalogue
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink">Administration</h1>
          <p className="mt-1 text-sm text-muted">Gérez produits, références et imports</p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAdminKey();
            window.location.reload();
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-red-200 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion admin
        </button>
      </div>

      <div className="card mb-6 overflow-hidden p-1">
        <div className="flex flex-wrap gap-1">
          {tabs.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-muted hover:bg-surface hover:text-ink'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      <AdminGate>
        <Outlet />
      </AdminGate>
    </div>
  );
}
