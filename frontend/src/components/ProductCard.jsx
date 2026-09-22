import { Link } from 'react-router-dom';
import { Package, ArrowUpRight } from 'lucide-react';
import { imageUrl, QUOTE_PRICE_TITLE } from '../api.js';
import PriceDisplay from './PriceDisplay.jsx';
import { displayBrand, isSpecOnlyName, readableCatalogText } from '../catalogText.js';

function refCountLabel(n) {
  if (n <= 0) return 'Aucune référence';
  if (n === 1) return '1 référence';
  return `${n} références`;
}

export default function ProductCard({ product }) {
  const img = imageUrl(product.display_image || product.image_path);
  const refCount = product.ref_count || 0;
  const name = readableCatalogText(product.name);
  const category = readableCatalogText(product.category_name || product.family_name || '');
  const description = readableCatalogText(product.description || '');
  const brand = displayBrand(product.brand);
  const specOnly = isSpecOnlyName(product.name);
  const title = specOnly && category ? category : name;
  const detailParts = [];
  if (specOnly && name && name !== title) detailParts.push(name);
  if (description && description.toLocaleLowerCase('fr-FR') !== title.toLocaleLowerCase('fr-FR')) {
    detailParts.push(description);
  }
  if (!detailParts.length) detailParts.push(refCountLabel(refCount));
  const subtitle = detailParts.join(' · ');
  const family = readableCatalogText(product.family_name || '');
  const footer =
    specOnly && category
      ? family && family.toLocaleLowerCase('fr-FR') !== category.toLocaleLowerCase('fr-FR')
        ? family
        : 'Voir le détail'
      : category || 'Voir le détail';

  return (
    <Link
      to={`/produit/${product.id}`}
      className="card card-hover group flex h-full flex-col overflow-hidden"
    >
      <div className="relative flex h-48 shrink-0 items-center justify-center overflow-hidden bg-slate-100">
        {img ? (
          <img
            src={img}
            alt={title}
            className="h-full w-full object-contain p-4"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted/60">
            <Package className="h-10 w-10" />
            <span className="text-xs">Image à venir</span>
          </div>
        )}
        {refCount > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-brand shadow-sm">
            {refCount === 1 ? '1 réf.' : `${refCount} réf.`}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 pt-3 hyphens-none">
        {brand && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            {brand}
          </span>
        )}
        <h3 className="font-display mt-1 line-clamp-2 text-base font-bold leading-snug text-ink group-hover:text-brand [overflow-wrap:normal] [word-break:normal]">
          {title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted [overflow-wrap:normal] [word-break:normal]">
          {subtitle}
        </p>
        <div className="mt-3">
          {product.price_on_quote_only ? (
            <span className="text-sm font-semibold text-brand-dark">{QUOTE_PRICE_TITLE}</span>
          ) : product.price_from_cdf != null ? (
            <div className="flex flex-wrap items-baseline gap-x-2">
              {product.price_from_multiple && (
                <span className="text-xs text-muted">À partir de</span>
              )}
              <PriceDisplay cdf={product.price_from_cdf} usd={product.price_from_usd} size="sm" />
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-medium text-brand">
          <span className="line-clamp-1">{footer}</span>
          <ArrowUpRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  );
}
