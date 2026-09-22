import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import PasswordInput from '../components/PasswordInput.jsx';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api.resetPassword({ token, password });
      setDone(r.message);
    } catch (err) {
      setError(err.message || 'Réinitialisation impossible');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-red-600">
        Lien invalide.{' '}
        <Link to="/mot-de-passe/oublie" className="text-brand hover:underline">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-muted">Au moins 8 caractères.</p>

      {done ? (
        <div className="card mt-6 p-6 text-sm">
          <p>{done}</p>
          <Link to="/connexion" className="mt-4 inline-block font-medium text-brand hover:underline">
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <label className="block">
            <span className="text-sm font-medium text-ink">Nouveau mot de passe</span>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
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
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}
    </div>
  );
}
