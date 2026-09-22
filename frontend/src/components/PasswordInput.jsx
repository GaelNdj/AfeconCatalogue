import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const defaultInputClass =
  'w-full rounded-lg border border-border bg-white py-2.5 pl-3 pr-10 text-sm outline-none transition focus:border-brand/40 focus:ring-4 focus:ring-brand/10';

export default function PasswordInput({
  className = defaultInputClass,
  inputClassName,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const inputClass = inputClassName ?? className;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={inputClass.includes('pr-') ? inputClass : `${inputClass} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition hover:text-ink"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
