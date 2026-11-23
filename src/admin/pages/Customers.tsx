import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button, Empty, ErrorState, PageLoader } from '../../components/ui';
import { birr, formatDate } from '../../lib/format';
import type { User } from '../../lib/types';
import { adminApi, PageHeader } from '../ui';

type Customer = User & { createdAt: string; orders: number; spent: number; lastOrderAt: string | null };

export default function Customers() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => setPage(1), [debounced]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'customers', debounced, page],
    queryFn: () => adminApi<{ customers: Customer[]; total: number; hasMore: boolean }>('/customers', { query: { q: debounced, page } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        action={
          <label className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, phone, @username"
              className="h-10 w-full rounded-full border border-seam bg-wool pl-9 pr-4 text-sm focus:border-camel focus:outline-none"
            />
          </label>
        }
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message="Couldn’t load customers." onRetry={() => refetch()} />
      ) : !data?.customers.length ? (
        <Empty title="No customers yet. They appear after signing in with Telegram." />
      ) : (
        <>
          <ul className="divide-y divide-seam rounded-xl border border-seam bg-wool">
            {data.customers.map((c) => (
              <li key={c.id} className="flex items-center gap-4 px-4 py-3">
                {c.photoUrl ? (
                  <img src={c.photoUrl} alt="" className="size-10 rounded-full object-cover" />
                ) : (
                  <span className="grid size-10 place-items-center rounded-full bg-wool-2 text-sm">{c.fullName.slice(0, 1)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.fullName}</p>
                  <p className="truncate font-mono text-xs text-steel">
                    {[c.phone, c.telegramUsername && `@${c.telegramUsername}`].filter(Boolean).join(' · ') || 'No phone yet'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm">{birr(c.spent)}</p>
                  <p className="text-xs text-steel">
                    {c.orders} orders{c.lastOrderAt ? ` · ${formatDate(c.lastOrderAt)}` : ''}
                  </p>
                </div>
                {c.telegramUsername && (
                  <a href={`https://t.me/${c.telegramUsername}`} target="_blank" rel="noreferrer" className="hidden text-xs text-camel sm:block">
                    Message
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between">
            <span className="font-mono text-xs text-steel">{data.total} customers</span>
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
