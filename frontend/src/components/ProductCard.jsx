import { Link } from 'react-router-dom';
import { Package, ArrowUpRight } from 'lucide-react';
import { imageUrl } from '../api.js';

export default function ProductCard({ product }) {
  const img = imageUrl(product.display_image || product.image_path);
  const refCount = product.ref_count || 0;

  return (
    <Link
      to={`/produit/${product.id}`}
      className="card card-hover group flex h-full flex-col overflow-hidden"
    >
      <div className="relative flex aspect-[5/4] items-center justify-center overflow-hidden bg-gradient-to-b from-surface to-white">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-contain p-6"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted/60">
            <Package className="h-10 w-10" />
            <span className="text-xs">Image à venir</span>
          </div>
        )}
        {refCount > 1 && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-brand shadow-sm backdrop-blur">
            {refCount} refs
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 pt-3">
        {product.brand && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            {product.brand}
          </span>
        )}
        <h3 className="font-display mt-1 line-clamp-2 text-base font-bold leading-snug text-ink group-hover:text-brand">
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
          {product.description || product.note || `${refCount} référence(s) disponible(s)`}
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-medium text-brand">
          <span>{product.category_name || product.family_name || 'Voir le détail'}</span>
          <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </Link>
  );
}
