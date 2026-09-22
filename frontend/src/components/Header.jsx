import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, MessageCircle, User, LogOut } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { count } = useCart();
  const { user, loading: authLoading, logout } = useAuth();
  const [q, setQ] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('q') || '';
  });

  function onSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    navigate(`/?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.25rem] max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-base font-bold text-white shadow-sm transition group-hover:shadow-md">
            A
          </span>
          <div className="hidden leading-tight sm:block">
            <span className="font-display text-lg font-bold tracking-tight text-ink">
              AfeconCatalogue
            </span>
            <span className="block text-[11px] font-medium text-muted">
              Catalogue professionnel
            </span>
          </div>
        </Link>

        <form onSubmit={onSubmit} className="mx-auto w-full max-w-2xl flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par code AFE, référence ou désignation…"
              className="w-full rounded-full border border-border bg-surface py-2.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-muted/80 focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/10"
            />
          </div>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-brand/30 hover:bg-brand-soft/50 sm:px-4"
            title="Pièce introuvable ? Contactez-nous"
          >
            <MessageCircle className="h-4 w-4 text-brand" />
            <span className="hidden lg:inline">Pièce introuvable ?</span>
          </Link>
          {!authLoading && !user && (
            <Link
              to="/connexion"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-brand/30 hover:bg-brand-soft/50 sm:px-4"
              title="Connexion"
            >
              <User className="h-4 w-4 text-brand" />
              <span className="hidden md:inline">Connexion</span>
            </Link>
          )}
          {!authLoading && user && (
            <>
              <Link
                to="/compte"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-brand/30 hover:bg-brand-soft/50 sm:px-4"
                title="Mon compte"
              >
                <User className="h-4 w-4 text-brand" />
                <span className="hidden md:inline">Compte</span>
              </Link>
              <button
                type="button"
                onClick={() => logout().then(() => navigate('/'))}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-ink-soft transition hover:border-red-200 hover:text-red-600 sm:px-4"
                title="Déconnexion"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">Déconnexion</span>
              </button>
            </>
          )}
          <Link
            to="/panier"
            className="relative inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-brand/30 hover:bg-brand-soft/50"
          >
            <ShoppingCart className="h-4 w-4 text-brand" />
            <span className="hidden md:inline">Panier</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
