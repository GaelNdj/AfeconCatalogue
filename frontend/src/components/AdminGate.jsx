import { useState } from 'react';
import { Lock } from 'lucide-react';
import PasswordInput from './PasswordInput.jsx';
import { api, getAdminKey, setAdminKey, clearAdminKey } from '../api.js';

export default function AdminGate({ children }) {
  const [key, setKey] = useState(() => getAdminKey());
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  if (key) return children;

  async function onSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Clé admin requise');
      return;
    }
    setChecking(true);
    setError('');
    setAdminKey(trimmed);
    try {
      await api.getMarginRules();
      setKey(trimmed);
    } catch (err) {
      clearAdminKey();
      setError(err.message || 'Clé invalide ou admin non configuré');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="card mx-auto mt-8 max-w-md p-8">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Lock className="h-6 w-6" />
      </div>
      <h2 className="font-display text-xl font-bold text-ink">Accès administration</h2>
      <p className="mt-2 text-sm text-muted">
        Saisissez la clé définie dans <code className="text-xs">ADMIN_API_KEY</code> (fichier{' '}
        <code className="text-xs">backend/.env</code>).
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <PasswordInput
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
          placeholder="Clé admin"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="current-password"
          disabled={checking}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {checking ? 'Vérification…' : 'Accéder'}
        </button>
      </form>
    </div>
  );
}
