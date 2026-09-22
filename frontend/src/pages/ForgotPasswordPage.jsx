import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api.forgotPassword({ email });
      setDone(r.message);
    } catch (err) {
      setError(err.message || 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-ink">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-muted">
        Indiquez votre e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe.
      </p>

      {done ? (
        <div className="card mt-6 p-6 text-sm text-ink">
          <p>{done}</p>
          <Link to="/connexion" className="mt-4 inline-block font-medium text-brand hover:underline">
            Retour à la connexion
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
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {busy ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
      )}
    </div>
  );
}
