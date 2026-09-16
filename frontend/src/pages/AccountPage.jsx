import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, LogOut, Package, User } from 'lucide-react';
import { api } from '../api.js';
import PriceDisplay from '../components/PriceDisplay.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

export default function AccountPage() {
  const { user, logout, updateProfile } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [profile, setProfile] = useState({
    company_name: '',
    phone: '',
    address_line: '',
    city: '',
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        company_name: user.company_name || '',
        phone: user.phone || '',
        address_line: user.address_line || '',
        city: user.city || '',
      });
    }
  }, [user]);

  useEffect(() => {
    api
      .getQuotes()
      .then((r) => setQuotes(r.items || []))
      .catch(() => setQuotes([]))
      .finally(() => setLoadingQuotes(false));
    api
      .getOrders()
      .then((r) => setOrders(r.items || []))
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, []);

  function formatDateFr(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString('fr-FR');
  }

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMsg('');
    setProfileBusy(true);
    try {
      await updateProfile(profile);
      setProfileMsg('Profil mis à jour');
    } catch (err) {
      setProfileMsg(err.message);
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Mon compte</h1>
          <p className="mt-1 text-sm text-muted">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted hover:border-red-200 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="card p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold text-ink">
            <User className="h-4 w-4 text-brand" />
            Coordonnées
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Société</span>
              <input
                required
                className={`mt-1 ${inputClass}`}
                value={profile.company_name}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Téléphone</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Adresse</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={profile.address_line}
                onChange={(e) => setProfile({ ...profile, address_line: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Ville</span>
              <input
                className={`mt-1 ${inputClass}`}
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              />
            </label>
          </div>
          {profileMsg && (
            <p className="mt-3 text-sm text-muted">{profileMsg}</p>
          )}
          <button
            type="submit"
            disabled={profileBusy}
            className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            Enregistrer
          </button>
        </form>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold text-ink">
            <FileText className="h-4 w-4 text-brand" />
            Mes devis
          </div>
          {loadingQuotes ? (
            <p className="text-sm text-muted">Chargement…</p>
          ) : quotes.length === 0 ? (
            <p className="text-sm text-muted">Aucun devis pour le moment.</p>
          ) : (
            <ul className="divide-y divide-border">
              {quotes.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      to={`/compte/devis/${q.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {q.quote_number}
                    </Link>
                    <div className="text-xs text-muted">
                      {new Date(q.created_at).toLocaleDateString('fr-FR')}
                      {q.valid_until && ` · valable jusqu'au ${formatDateFr(q.valid_until)}`}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <PriceDisplay cdf={q.total_cdf} usd={q.total_usd} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 font-semibold text-ink">
            <Package className="h-4 w-4 text-brand" />
            Mes commandes
          </div>
          {loadingOrders ? (
            <p className="text-sm text-muted">Chargement…</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted">Aucune commande pour le moment.</p>
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      to={`/compte/commande/${o.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {o.order_number}
                    </Link>
                    <div className="text-xs text-muted">
                      {new Date(o.created_at).toLocaleDateString('fr-FR')}
                      {o.quote_number && ` · devis ${o.quote_number}`}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <PriceDisplay cdf={o.total_cdf} usd={o.total_usd} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
