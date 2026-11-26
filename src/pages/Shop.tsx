import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ProductGrid } from '../components/product/ProductCard';
import { Button, Empty, ErrorState, Sheet, Spinner } from '../components/ui';
import { useCategories, useFacets, useInfiniteProducts, type ProductFilters } from '../hooks/queries';
import { useT } from '../lib/i18n';
import { cn, sortSizes } from '../lib/format';
import { Dropdown } from '../components/ui/Dropdown';

const SORTS = ['new', 'price_asc', 'price_desc'] as const;
type Sort = (typeof SORTS)[number];

const chipClass = (active: boolean) =>
  cn(
    'inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors',
    active ? 'border-chalk bg-chalk text-ink' : 'border-seam text-chalk/80 hover:border-steel',
  );

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={chipClass(active)}>
      {children}
    </button>
  );
}

export default function Shop({ search = false }: { search?: boolean }) {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const { t, pick } = useT();
  const { data: categories } = useCategories();
  const { data: facets } = useFacets(category);
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const list = (k: string) => params.get(k)?.split(',').filter(Boolean) ?? [];
  const filters: ProductFilters = {
    category,
    size: list('size'),
    color: list('color'),
    brand: list('brand'),
    inStock: params.get('inStock') === '1',
    sort: (SORTS as readonly string[]).includes(params.get('sort') ?? '') ? (params.get('sort') as Sort) : 'new',
    q: params.get('q') ?? undefined,
  };
  const activeCount = (filters.size?.length ?? 0) + (filters.color?.length ?? 0) + (filters.brand?.length ?? 0) + (filters.inStock ? 1 : 0);

  const enabled = !search || Boolean(filters.q);
  const query$ = useInfiniteProducts(filters, enabled);
  const products = useMemo(() => query$.data?.pages.flatMap((p) => p.products), [query$.data]);
  const total = query$.data?.pages[0]?.total ?? 0;

  // Debounced search → URL
  useEffect(() => {
    if (!search) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (query.trim()) next.set('q', query.trim());
      else next.delete('q');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, search]);

  useEffect(() => {
    if (search) inputRef.current?.focus();
  }, [search]);

  // Infinite scroll
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && query$.hasNextPage && !query$.isFetchingNextPage) void query$.fetchNextPage();
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [query$]);

  const toggle = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    const current = new Set(list(key));
    if (current.has(value)) current.delete(value);
    else current.add(value);
    if (current.size) next.set(key, [...current].join(','));
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const clearFilters = () => {
    const next = new URLSearchParams();
    if (params.get('q')) next.set('q', params.get('q')!);
    if (params.get('sort')) next.set('sort', params.get('sort')!);
    setParams(next, { replace: true });
  };

  const current = categories?.find((c) => c.slug === category);
  const title = search ? '' : current ? pick(current.nameEn, current.nameAm) : t('nav.shop');

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8 md:pt-10">
      {search ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-steel" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('shop.search')}
            type="search"
            enterKeyHint="search"
            className="h-14 w-full rounded-full border border-seam bg-wool pl-12 pr-12 text-base placeholder:text-steel/70 focus:border-camel focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-steel" aria-label={t('shop.clear')}>
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <h1 className="display text-[2rem] md:text-5xl">{title}</h1>
      )}

      {!search && (
        <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Link to={`/shop${params.get('sort') ? `?sort=${params.get('sort')}` : ''}`} className={chipClass(!category)}>
            {t('shop.all')}
          </Link>
          {categories
            ?.filter((c) => (c.productCount ?? 0) > 0)
            .map((c) => (
              <Link key={c.id} to={`/shop/${c.slug}`} className={chipClass(c.slug === category)}>
                {pick(c.nameEn, c.nameAm)}
              </Link>
            ))}
        </div>
      )}

      {enabled && (
        <div className="mt-6 flex items-center justify-between border-b border-seam pb-4">
          <span className="font-mono text-xs text-steel">{t('shop.items', { n: total })}</span>
          <div className="flex items-center gap-2">
            <Dropdown
              size="pill"
              align="right"
              ariaLabel={t('shop.sort')}
              value={filters.sort ?? 'new'}
              onChange={(v) => setParam('sort', v === 'new' ? null : v)}
              options={SORTS.map((s) => ({ value: s, label: t(`sort.${s}`) }))}
            />
            <button
              onClick={() => setFilterOpen(true)}
              className={cn('flex h-9 items-center gap-2 rounded-full border px-3 text-sm', activeCount ? 'border-camel text-camel' : 'border-seam text-chalk/90')}
            >
              <SlidersHorizontal className="size-4" />
              {t('shop.filter')}
              {activeCount > 0 && <span className="font-mono text-xs">{activeCount}</span>}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {!enabled ? null : query$.isError ? (
          <ErrorState message={t('common.loadError')} onRetry={() => query$.refetch()} retryLabel={t('common.retry')} />
        ) : products && products.length === 0 ? (
          <Empty
            title={t('shop.empty')}
            action={
              activeCount > 0 ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {t('shop.clear')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ProductGrid products={products} loading={query$.isLoading} />
        )}
        <div ref={sentinel} className="flex h-16 items-center justify-center">
          {query$.isFetchingNextPage && <Spinner />}
        </div>
      </div>

      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t('shop.filter')}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={clearFilters} disabled={!activeCount}>
              {t('shop.clear')}
            </Button>
            <Button variant="accent" block onClick={() => setFilterOpen(false)}>
              {t('shop.show', { n: total })}
            </Button>
          </div>
        }
      >
        <div className="space-y-8">
          {(facets?.sizes.length ?? 0) > 0 && (
            <section>
              <p className="label mb-3">{t('product.size')}</p>
              <div className="flex flex-wrap gap-2">
                {sortSizes(facets!.sizes).map((s) => (
                  <button
                    key={s}
                    onClick={() => toggle('size', s)}
                    className={cn(
                      'h-11 min-w-12 rounded-md border px-3 font-mono text-sm',
                      filters.size?.includes(s) ? 'border-camel bg-camel text-ink' : 'border-seam text-chalk/80',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}
          {(facets?.colors.length ?? 0) > 0 && (
            <section>
              <p className="label mb-3">{t('product.color')}</p>
              <div className="flex flex-wrap gap-2">
                {facets!.colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => toggle('color', c.name)}
                    className={cn(
                      'flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-3 text-sm',
                      filters.color?.includes(c.name) ? 'border-camel text-chalk' : 'border-seam text-chalk/80',
                    )}
                  >
                    <span className="size-7 rounded-full ring-1 ring-seam" style={{ background: c.hex ?? '#555' }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {(facets?.brands.length ?? 0) > 0 && (
            <section>
              <p className="label mb-3">{t('shop.brand')}</p>
              <div className="flex flex-wrap gap-2">
                {facets!.brands.map((b) => (
                  <Chip key={b.slug} active={Boolean(filters.brand?.includes(b.slug))} onClick={() => toggle('brand', b.slug)}>
                    {b.name}
                  </Chip>
                ))}
              </div>
            </section>
          )}
          <label className="flex items-center justify-between rounded-xl border border-seam px-4 py-4">
            <span>{t('shop.inStock')}</span>
            <input
              type="checkbox"
              checked={Boolean(filters.inStock)}
              onChange={(e) => setParam('inStock', e.target.checked ? '1' : null)}
              className="size-5 accent-[#B98B57]"
            />
          </label>
        </div>
      </Sheet>
    </div>
  );
}
