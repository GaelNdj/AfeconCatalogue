import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/compte';
  const [form, setForm] = useState({
    email: '',
    password: '',
    company_name: '',
    phone: '',
    address_line: '',
    city: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Inscription impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">Créer un compte</h1>
      <p className="mt-2 text-sm text-muted">
        Compte professionnel requis pour demander un devis.
      </p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium text-ink">E-mail <span className="text-accent">*</span></span>
          <input
            type="email"
            required
            className={`mt-1.5 ${inputClass}`}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Mot de passe <span className="text-accent">*</span></span>
          <PasswordInput
            required
            minLength={8}
            className={`mt-1.5 ${inputClass}`}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
          <span className="mt-1 block text-xs text-muted">8 caractères minimum</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Société <span className="text-accent">*</span></span>
          <input
            required
            className={`mt-1.5 ${inputClass}`}
            value={form.company_name}
            onChange={(e) => set('company_name', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Téléphone</span>
          <input
            className={`mt-1.5 ${inputClass}`}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Adresse</span>
          <input
            className={`mt-1.5 ${inputClass}`}
            value={form.address_line}
            onChange={(e) => set('address_line', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Ville</span>
          <input
            className={`mt-1.5 ${inputClass}`}
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? 'Création…' : 'Créer mon compte'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Déjà inscrit ?{' '}
        <Link
          to={`/connexion?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-brand hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
