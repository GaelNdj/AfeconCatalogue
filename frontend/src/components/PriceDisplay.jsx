import { formatCdf, formatUsd, isQuotePrice, QUOTE_PRICE_HINT, QUOTE_PRICE_TITLE } from '../api.js';

/**
 * Affichage visiteur : CDF en principal, USD en secondaire.
 * @param {'inline'|'stacked'} layout — inline (défaut) ou empilé (CDF au-dessus, USD en dessous)
 * @param {'sm'|'md'|'lg'|'xl'} size — taille du CDF (stacked ou inline)
 * @param {boolean} cdfOnly — masque l’USD
 */
export default function PriceDisplay({
  ref,
  cdf,
  usd,
  className = '',
  layout = 'inline',
  size = 'md',
  cdfOnly = false,
}) {
  if (isQuotePrice(ref)) {
    const quoteSize =
      size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm';
    return (
      <div className={className}>
        <div className={`${quoteSize} font-bold leading-tight text-brand-dark`}>
          {QUOTE_PRICE_TITLE}
        </div>
        <div className="mt-0.5 text-[10px] font-medium leading-snug text-muted">
          {QUOTE_PRICE_HINT}
        </div>
      </div>
    );
  }

  const amountCdf = cdf ?? ref?.display_price_cdf;
  const amountUsd = usd ?? ref?.display_price_usd;

  if (amountCdf == null) {
    return <span className={`text-muted ${className}`}>—</span>;
  }

  const cdfClass =
    size === 'xl'
      ? 'text-3xl font-bold tracking-tight text-ink sm:text-4xl'
      : size === 'lg'
        ? 'text-2xl font-bold text-brand-dark'
        : size === 'sm'
          ? 'text-xs font-semibold text-brand-dark'
          : 'font-bold text-brand-dark';

  const usdClass =
    size === 'xl'
      ? 'mt-1 text-sm font-medium text-muted'
      : 'mt-0.5 text-sm font-medium text-muted';

  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col items-start ${className}`}>
        <span className={cdfClass}>{formatCdf(amountCdf)}</span>
        {!cdfOnly && amountUsd != null && (
          <span className={usdClass}>{formatUsd(amountUsd)}</span>
        )}
      </div>
    );
  }

  if (cdfOnly) {
    return (
      <span className={`whitespace-nowrap ${cdfClass} ${className}`}>
        {formatCdf(amountCdf)}
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0 ${className}`}>
      <span className={cdfClass}>{formatCdf(amountCdf)}</span>
      {amountUsd != null && (
        <span className="text-[11px] font-medium text-muted">{formatUsd(amountUsd)}</span>
      )}
    </div>
  );
}
