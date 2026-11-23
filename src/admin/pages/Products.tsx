import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button, Empty, ErrorState, PageLoader, buttonClass } from '../../components/ui';
import { birr, cn } from '../../lib/format';
import type { AdminProduct } from '../types';
import { adminApi, PageHeader, Tabs } from '../ui';

type Tab = 'active' | 'draft' | 'low' | 'archived';
const TAB_QUERY: Record<Tab, Record<string, string>> = {
  active: { status: 'ACTIVE' },
  draft: { status: 'DRAFT' },
  low: { lowStock: '1', status: 'ACTIVE' },
  archived: { status: 'ARCHIVED' },
};

export default function Products() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'active';
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => setPage(1), [tab, debounced]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'products', tab, debounced, page],
    queryFn: () => adminApi<{ products: AdminProduct[]; total: number; hasMore: boolean }>('/products', { query: { ...TAB_QUERY[tab], q: debounced, page } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Products"
        action={
          <Link to="/admin/products/new" className={buttonClass('accent', 'sm')}>
            <Plus className="size-4" /> New product
          </Link>
        }
      />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === 'active' ? {} : { tab: v })}
          tabs={[
            { value: 'active', label: 'On sale' },
            { value: 'draft', label: 'Drafts' },
            { value: 'low', label: 'Low stock' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <label className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, brand, SKU…"
            className="h-10 w-full rounded-full border border-seam bg-wool pl-9 pr-4 text-sm focus:border-camel focus:outline-none"
          />
        </label>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message="Couldn’t load products." onRetry={() => refetch()} />
      ) : !data?.products.length ? (
        <Empty
          title={tab === 'draft' ? 'No drafts. Imported Telegram posts land here.' : 'No products here.'}
          action={
            <Link to="/admin/products/new" className={buttonClass('primary', 'sm')}>
              Add a product
            </Link>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.products.map((p) => {
              const low = p.variants.filter((v) => v.isActive && v.stock <= 2).length;
              return (
                <li key={p.id}>
                  <Link to={`/admin/products/${p.id}`} className="group block overflow-hidden rounded-xl border border-seam bg-wool">
                    <div className="relative aspect-[4/5] bg-wool-2">
                      {p.images[0] && <img src={p.images[0].urls.sm} alt="" className="size-full object-cover" loading="lazy" />}
                      {p.status !== 'ACTIVE' && (
                        <span className="absolute left-2 top-2 rounded bg-ink/85 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-steel">{p.status}</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm group-hover:text-camel">{p.nameEn}</p>
                      <div className="mt-1 flex items-center justify-between text-xs">
                        <span className="font-mono">{birr(p.basePrice)}</span>
                        <span className={cn('font-mono', p.totalStock === 0 ? 'text-danger' : low ? 'text-camel' : 'text-steel')}>{p.totalStock} pcs</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex items-center justify-between">
            <span className="font-mono text-xs text-steel">{data.total} products</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
