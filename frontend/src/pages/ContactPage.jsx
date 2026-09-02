import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle, Send, CheckCircle2, HelpCircle } from 'lucide-react';
import { api } from '../api.js';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  company: '',
  part_description: '',
  reference: '',
  brand: '',
  dimensions: '',
  message: '',
};

function Field({ label, required, children, hint }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    ...emptyForm,
    reference: searchParams.get('ref') || '',
    part_description: searchParams.get('q') ? `Recherche : ${searchParams.get('q')}` : '',
  });
  const searchedFor = searchParams.get('q') || '';
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await api.submitContact({
        ...form,
        searched_for: searchedFor,
      });
      setResult(res);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand via-brand to-brand-dark px-6 py-8 text-white sm:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">
                Vous ne trouvez pas la pièce dont vous avez besoin ?
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-teal-50/95">
                Pas de problème — décrivez-nous ce que vous recherchez et nous reviendrons vers
                vous rapidement avec une proposition ou une alternative.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {result?.ok ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="font-display text-xl font-bold text-ink">Demande envoyée</h2>
              <p className="mt-2 max-w-md text-sm text-muted">{result.message}</p>
              <Link
                to="/"
                className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Retour au catalogue
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              {searchedFor && (
                <div className="rounded-lg border border-brand/20 bg-brand-soft/50 px-4 py-3 text-sm text-brand-dark">
                  Recherche effectuée : <strong>« {searchedFor} »</strong> — nous l’inclurons dans
                  votre demande.
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nom / Prénom" required>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Jean Dupont"
                    required
                  />
                </Field>
                <Field label="Société" hint="Optionnel">
                  <input
                    className={inputClass}
                    value={form.company}
                    onChange={(e) => set('company', e.target.value)}
                    placeholder="Nom de votre entreprise"
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="E-mail" required>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="vous@exemple.fr"
                    required
                  />
                </Field>
                <Field label="Téléphone" hint="Optionnel">
                  <input
                    type="tel"
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="06 12 34 56 78"
                  />
                </Field>
              </div>

              <Field
                label="Description de la pièce recherchée"
                required
                hint="Type de produit, usage, matériau, contexte chantier…"
              >
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={form.part_description}
                  onChange={(e) => set('part_description', e.target.value)}
                  placeholder="Ex. : Coude cuivre 90° MF Ø15 pour réseau chauffage…"
                  required
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Référence / code connu" hint="Si vous en avez une">
                  <input
                    className={inputClass}
                    value={form.reference}
                    onChange={(e) => set('reference', e.target.value)}
                    placeholder="P329601, 7350142…"
                  />
                </Field>
                <Field label="Marque">
                  <input
                    className={inputClass}
                    value={form.brand}
                    onChange={(e) => set('brand', e.target.value)}
                    placeholder="Altech, Geberit…"
                  />
                </Field>
                <Field label="Dimensions">
                  <input
                    className={inputClass}
                    value={form.dimensions}
                    onChange={(e) => set('dimensions', e.target.value)}
                    placeholder="90 x 90 cm, Ø15…"
                  />
                </Field>
              </div>

              <Field label="Message complémentaire" hint="Optionnel">
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={form.message}
                  onChange={(e) => set('message', e.target.value)}
                  placeholder="Quantité, délai souhaité, photos disponibles…"
                />
              </Field>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                <p className="text-xs text-muted">
                  Les champs marqués <span className="text-accent">*</span> sont obligatoires.
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {busy ? 'Envoi en cours…' : 'Envoyer ma demande'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
