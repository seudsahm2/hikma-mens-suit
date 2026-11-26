/**
 * Customers: who buys (week / month / all time), the best customers, regulars who went quiet,
 * one tap to their Telegram chat, and "send a product" to the ones you pick.
 */
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Search, Send, Sparkles } from 'lucide-react';
import { Button, Empty, ErrorState, PageLoader } from '../../components/ui';
import { birr, cn, formatDate } from '../../lib/format';
import { adminApi, PageHeader, Tabs } from '../ui';
import { AnnounceSheet, tgLink, type CustomerRow } from './AnnounceSheet';

type Period = 'week' | 'month' | 'all';
interface Insights {
  buyers: number;
  orders: number;
  revenue: number;
  avgOrder: number;
  newCustomers: number;
  returningPct: number;
  subscribers: number;
  topBySpend: CustomerRow[];
  topByOrders: CustomerRow[];
  winBack: CustomerRow[];
}

function Person({ c, rank, right, selected, onSelect }: { c: CustomerRow; rank?: number; right: React.ReactNode; selected?: boolean; onSelect?: () => void }) {
  const link = tgLink(c);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          disabled={!c.telegramId}
          aria-label={selected ? 'Unselect' : 'Select'}
          className={cn('grid size-5 shrink-0 place-items-center rounded-md border transition-colors', selected ? 'border-camel bg-camel text-ink' : 'border-seam hover:border-steel', !c.telegramId && 'opacity-30')}
        >
          {selected && <Check className="size-3.5" strokeWidth={3} />}
        </button>
      )}
      {rank !== undefined && <span className={cn('w-5 shrink-0 text-center font-mono text-sm', rank <= 3 ? 'text-camel' : 'text-steel')}>{rank}</span>}
      {/* The whole person opens their Telegram chat */}
      <a href={link ?? undefined} target="_blank" rel="noreferrer" className={cn('group flex min-w-0 flex-1 items-center gap-3', !link && 'pointer-events-none')}>
        {c.photoUrl ? (
          <img src={c.photoUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-wool-2 text-sm">{c.fullName.slice(0, 1)}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-sm group-hover:text-camel">
            {c.fullName}
            {link && <Send className="size-3 shrink-0 text-[#2AABEE] opacity-70" />}
          </span>
          <span className="block truncate font-mono text-xs text-steel">{[c.telegramUsername && `@${c.telegramUsername}`, c.phone].filter(Boolean).join(' · ') || 'No contact yet'}</span>
        </span>
      </a>
      <div className="shrink-0 text-right">{right}</div>
    </li>
  );
}

export default function Customers() {
  const [period, setPeriod] = useState<Period>('month');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, CustomerRow>>(new Map());
  const [announce, setAnnounce] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => setPage(1), [debounced]);

  const ins = useQuery({
    queryKey: ['admin', 'customers', 'insights', period],
    queryFn: () => adminApi<Insights>('/customers/insights', { query: { period } }),
    placeholderData: keepPreviousData,
  });
  const list = useQuery({
    queryKey: ['admin', 'customers', debounced, page],
    queryFn: () => adminApi<{ customers: CustomerRow[]; total: number; hasMore: boolean }>('/customers', { query: { q: debounced, page } }),
    placeholderData: keepPreviousData,
  });

  const toggle = (c: CustomerRow) =>
    setSelected((m) => {
      const n = new Map(m);
      if (n.has(c.id)) n.delete(c.id);
      else n.set(c.id, c);
      return n;
    });
  const selectAll = (rows: CustomerRow[]) =>
    setSelected((m) => {
      const n = new Map(m);
      const all = rows.filter((c) => c.telegramId).every((c) => n.has(c.id));
      for (const c of rows) if (c.telegramId) all ? n.delete(c.id) : n.set(c.id, c);
      return n;
    });
  const d = ins.data;

  const Board = ({ title, rows, metric }: { title: string; rows: CustomerRow[]; metric: (c: CustomerRow) => React.ReactNode }) => (
    <section className="overflow-hidden rounded-2xl border border-seam/80 bg-wool">
      <div className="flex items-center justify-between border-b border-seam/60 px-4 py-3">
        <h2 className="label">{title}</h2>
        {rows.length > 0 && (
          <button type="button" onClick={() => selectAll(rows)} className="text-xs text-camel">
            {rows.filter((c) => c.telegramId).every((c) => selected.has(c.id)) ? 'Unselect' : 'Select all'}
          </button>
        )}
      </div>
      {rows.length ? (
        <ul className="divide-y divide-seam/50">
          {rows.map((c, i) => (
            <Person key={c.id} c={c} rank={i + 1} right={metric(c)} selected={selected.has(c.id)} onSelect={() => toggle(c)} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-steel">No orders in this period yet.</p>
      )}
    </section>
  );

  return (
    <div className="pb-24">
      <PageHeader title="Customers" />

      <Tabs
        value={period}
        onChange={setPeriod}
        tabs={[
          { value: 'week', label: 'This week' },
          { value: 'month', label: 'This month' },
          { value: 'all', label: 'All time' },
        ]}
      />

      {ins.isLoading ? (
        <PageLoader />
      ) : ins.error || !d ? (
        <ErrorState message="Couldn’t load customer insights." onRetry={() => ins.refetch()} />
      ) : (
        <div className={cn('mt-5 space-y-5 transition-opacity', ins.isFetching && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Customers who bought', d.buyers, `${d.orders} orders`],
              ['New customers', d.newCustomers, 'signed up'],
              ['Came back', `${d.returningPct}%`, 'had bought before'],
              ['Average order', birr(d.avgOrder), `${birr(d.revenue)} total`],
            ].map(([label, value, sub]) => (
              <div key={label as string} className="rounded-2xl border border-seam/80 bg-wool p-4">
                <p className="label !text-[0.6rem]">{label}</p>
                <p className="mt-1 font-mono text-2xl">{value}</p>
                <p className="mt-0.5 text-xs text-steel">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Board title="Top by spending" rows={d.topBySpend} metric={(c) => <><p className="font-mono text-sm">{birr(c.spent)}</p><p className="text-xs text-steel">{c.orders} order{c.orders === 1 ? '' : 's'}</p></>} />
            <Board title="Top by orders" rows={d.topByOrders} metric={(c) => <><p className="font-mono text-sm">{c.orders} order{c.orders === 1 ? '' : 's'}</p><p className="text-xs text-steel">{birr(c.spent)}</p></>} />
          </div>

          {d.winBack.length > 0 && (
            <Board
              title="Regulars gone quiet · 45+ days"
              rows={d.winBack}
              metric={(c) => <><p className="font-mono text-sm">{birr(c.spent)}</p><p className="text-xs text-steel">last {c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</p></>}
            />
          )}
          <p className="text-xs text-steel">🔔 {d.subscribers} customers get new-arrival messages. Tap a person to open their Telegram chat.</p>
        </div>
      )}

      {/* Everyone */}
      <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="label">All customers{list.data ? ` · ${list.data.total}` : ''}</h2>
        <label className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, @username" className="h-10 w-full rounded-full border border-seam bg-wool pl-9 pr-4 text-sm focus:border-camel focus:outline-none" />
        </label>
      </div>
      {list.isLoading ? (
        <PageLoader />
      ) : list.error ? (
        <ErrorState message="Couldn’t load customers." onRetry={() => list.refetch()} />
      ) : !list.data?.customers.length ? (
        <Empty title="No customers yet. They appear after signing in with Telegram." />
      ) : (
        <>
          <ul className="divide-y divide-seam/50 overflow-hidden rounded-2xl border border-seam/80 bg-wool">
            {list.data.customers.map((c) => (
              <Person
                key={c.id}
                c={c}
                selected={selected.has(c.id)}
                onSelect={() => toggle(c)}
                right={<><p className="font-mono text-sm">{birr(c.spent)}</p><p className="text-xs text-steel">{c.orders} order{c.orders === 1 ? '' : 's'}{c.lastOrderAt ? ` · ${formatDate(c.lastOrderAt)}` : ''}</p></>}
              />
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!list.data.hasMore} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}

      {/* Selection → send a product */}
      {selected.size > 0 && (
        <div onMouseDown={(e) => e.preventDefault()} className="fixed inset-x-0 bottom-0 z-30 border-t border-seam bg-ink/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:left-[248px]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <span className="flex-1 text-sm">
              <b>{selected.size}</b> selected{' '}
              <button type="button" onClick={() => setSelected(new Map())} className="ml-2 text-xs text-steel underline underline-offset-2">
                clear
              </button>
            </span>
            <Button variant="accent" onClick={() => setAnnounce(true)}>
              <Sparkles className="size-4" /> Send a product
            </Button>
          </div>
        </div>
      )}
      <AnnounceSheet open={announce} onClose={() => setAnnounce(false)} customers={[...selected.values()]} />
    </div>
  );
}
