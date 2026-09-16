import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/compte';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">Connexion</h1>
      <p className="mt-2 text-sm text-muted">
        Connectez-vous pour demander un devis et consulter votre historique.
      </p>

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <label className="block">
          <span className="text-sm font-medium text-ink">E-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            className={`mt-1.5 ${inputClass}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">Mot de passe</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            className={`mt-1.5 ${inputClass}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link
          to={`/inscription?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-brand hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
