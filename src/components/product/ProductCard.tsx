import { Link } from 'react-router';
import { BadgeCheck, Star } from 'lucide-react';
import { Img, Price, Skeleton } from '../ui';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/format';
import type { ProductCard as Card } from '../../lib/types';

export function ProductCard({ product, priority, className }: { product: Card; priority?: boolean; className?: string }) {
  const { t, pick } = useT();
  const name = pick(product.nameEn, product.nameAm);
  const [first, second] = product.images;
  return (
    <Link to={`/p/${product.slug}`} className={cn('group block', className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-wool">
        <Img urls={first?.urls} alt={name} priority={priority} className="size-full transition-transform duration-700 ease-[var(--ease-tailor)] group-hover:scale-[1.03]" />
        {second && (
          <Img
            urls={second.urls}
            alt=""
            className="absolute inset-0 size-full opacity-0 transition-opacity duration-500 md:group-hover:opacity-100"
          />
        )}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded-sm bg-ink/85 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-widest text-steel">
            {t('product.soldOut')}
          </span>
        )}
        {product.inStock && product.badge && (
          <span className="absolute left-2 top-2 rounded-sm bg-camel px-2 py-1 font-mono text-[0.6rem] uppercase tracking-widest text-ink">
            {product.badge}
          </span>
        )}
        {product.original && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-1 text-[0.6rem] font-medium uppercase tracking-wider text-chalk backdrop-blur">
            <BadgeCheck className="size-3 text-camel" /> {t('orig.badge')}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 px-0.5">
        {(product.brand || product.rating) && (
          <div className="flex items-center justify-between gap-2">
            <span className="label !text-[0.6rem]">{product.brand?.name}</span>
            {product.rating && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[0.65rem] text-chalk/80">
                <Star className="size-3 fill-camel text-camel" /> {product.rating.average.toFixed(1)}
              </span>
            )}
          </div>
        )}
        <div className="line-clamp-1 text-[0.92rem] font-medium leading-snug">{name}</div>
        <div className="flex items-center justify-between gap-2">
          <Price value={product.price} compareAt={product.compareAtPrice} className="text-[0.85rem] text-chalk/90" />
          {product.colors.length > 1 && (
            <span className="flex -space-x-1" aria-label={product.colors.map((c) => c.name).join(', ')}>
              {product.colors.slice(0, 4).map((c) => (
                <span key={c.name} className="size-3 rounded-full ring-1 ring-ink" style={{ background: c.hex ?? '#555' }} />
              ))}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-2 h-4 w-3/4" />
    </div>
  );
}

export function ProductGrid({ products, loading, count = 8 }: { products?: Card[]; loading?: boolean; count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
      {loading && !products
        ? Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)
        : products?.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
    </div>
  );
}

/** Horizontal, swipeable row (home page rails, related items). */
export function ProductRail({ products, loading }: { products?: Card[]; loading?: boolean }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:-mx-8 md:gap-5 md:px-8">
      {loading && !products
        ? Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="w-[44vw] shrink-0 md:w-64">
              <ProductCardSkeleton />
            </div>
          ))
        : products?.map((p) => <ProductCard key={p.id} product={p} className="w-[44vw] shrink-0 snap-start md:w-64" />)}
    </div>
  );
}
