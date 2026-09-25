import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileText, Package, ShoppingCart, User } from 'lucide-react';
import { api } from '../api.js';
import PriceDisplay from '../components/PriceDisplay.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

const tabs = [
  { id: 'profil', label: 'Profil', icon: User },
  { id: 'devis', label: 'Devis', icon: FileText },
  { id: 'commandes', label: 'Commandes', icon: Package },
];

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDateFr(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('fr-FR');
}

function quoteStatus(quote) {
  if (quote.status === 'converted') {
    return { label: 'Commandé', className: 'bg-emerald-50 text-emerald-800' };
  }
  const until = quote.valid_until ? String(quote.valid_until).slice(0, 10) : '';
  if (until && until < todayIso()) {
    return { label: 'Expiré', className: 'bg-slate-100 text-slate-600' };
  }
  return { label: 'En attente', className: 'bg-amber-50 text-amber-800' };
}

function paymentStatus(order) {
  if (order.payment_status === 'paid') {
    return { label: 'Payée', className: 'bg-emerald-50 text-emerald-800' };
  }
  if (order.payment_status === 'failed') {
    return { label: 'Paiement échoué', className: 'bg-red-50 text-red-700' };
  }
  return { label: 'Paiement en attente', className: 'bg-amber-50 text-amber-800' };
}

function StatusBadge({ label, className }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

export default function AccountPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profil');
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [profile, setProfile] = useState({
    contact_name: '',
    company_name: '',
    phone: '',
    address_line: '',
    city: '',
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState(null);
  const [orderBusyId, setOrderBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (user) {
      setProfile({
        contact_name: user.contact_name || '',
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

  async function downloadPdf(quote) {
    setActionError('');
    setPdfBusyId(quote.id);
    try {
      await api.downloadQuotePdf(quote.id);
    } catch (err) {
      setActionError(err.message || 'Téléchargement impossible');
    } finally {
      setPdfBusyId(null);
    }
  }

  async function convertQuote(quote) {
    setActionError('');
    setOrderBusyId(quote.id);
    try {
      const r = await api.createOrder({ quote_id: quote.id });
      navigate(`/compte/commande/${r.order.id}/paiement`);
    } catch (err) {
      setActionError(err.message || 'Conversion impossible');
      setOrderBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Mon compte</h1>
        <p className="mt-1 text-sm text-muted">{user?.email}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <nav className="flex gap-2 md:flex-col">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                tab === id
                  ? 'bg-brand text-white'
                  : 'bg-white text-ink-soft hover:bg-brand-soft hover:text-brand-dark'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div>
          {actionError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </p>
          )}

          {tab === 'profil' && (
            <form onSubmit={saveProfile} className="card p-5">
              <h2 className="mb-4 font-semibold text-ink">Profil</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Nom / Prénom</span>
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={profile.contact_name}
                    onChange={(e) => setProfile({ ...profile, contact_name: e.target.value })}
                    placeholder="Nom du contact principal"
                  />
                </label>
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
                  <span className="text-sm font-medium">Ville</span>
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={profile.city}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium">Adresse</span>
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={profile.address_line}
                    onChange={(e) => setProfile({ ...profile, address_line: e.target.value })}
                  />
                </label>
              </div>
              {profileMsg && <p className="mt-3 text-sm text-muted">{profileMsg}</p>}
              <button
                type="submit"
                disabled={profileBusy}
                className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                Enregistrer
              </button>
            </form>
          )}

          {tab === 'devis' && (
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-ink">Mes devis</h2>
              {loadingQuotes ? (
                <p className="text-sm text-muted">Chargement…</p>
              ) : quotes.length === 0 ? (
                <p className="text-sm text-muted">Aucun devis pour le moment.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {quotes.map((q) => {
                    const status = quoteStatus(q);
                    const expired = status.label === 'Expiré';
                    const canConvert = q.status !== 'converted' && !expired && !q.has_quote_only_lines;
                    return (
                      <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/compte/devis/${q.id}`}
                              className="font-medium text-brand hover:underline"
                            >
                              {q.quote_number}
                            </Link>
                            <StatusBadge label={status.label} className={status.className} />
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {formatDateFr(q.created_at)}
                            {q.valid_until && ` · valable jusqu'au ${formatDateFr(q.valid_until)}`}
                          </div>
                          <div className="mt-2">
                            <PriceDisplay cdf={q.total_cdf} usd={q.total_usd} size="sm" />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => downloadPdf(q)}
                            disabled={pdfBusyId === q.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand disabled:opacity-60"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {pdfBusyId === q.id ? 'PDF…' : 'Télécharger PDF'}
                          </button>
                          {canConvert && (
                            <button
                              type="button"
                              onClick={() => convertQuote(q)}
                              disabled={orderBusyId === q.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              {orderBusyId === q.id ? 'Conversion…' : 'Convertir en commande'}
                            </button>
                          )}
                          {q.order_id && (
                            <Link
                              to={`/compte/commande/${q.order_id}`}
                              className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface"
                            >
                              Voir la commande
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'commandes' && (
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-ink">Mes commandes</h2>
              {loadingOrders ? (
                <p className="text-sm text-muted">Chargement…</p>
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted">Aucune commande pour le moment.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {orders.map((o) => {
                    const status = paymentStatus(o);
                    const unpaid = o.payment_status !== 'paid';
                    return (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/compte/commande/${o.id}`}
                              className="font-medium text-brand hover:underline"
                            >
                              {o.order_number}
                            </Link>
                            <StatusBadge label={status.label} className={status.className} />
                          </div>
                          <div className="mt-1 text-xs text-muted">
                            {formatDateFr(o.created_at)}
                            {o.quote_number && ` · devis ${o.quote_number}`}
                          </div>
                          <div className="mt-2">
                            <PriceDisplay cdf={o.total_cdf} usd={o.total_usd} size="sm" />
                          </div>
                        </div>
                        {unpaid && (
                          <Link
                            to={`/compte/commande/${o.id}/paiement`}
                            className="inline-flex items-center rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                          >
                            Payer
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
