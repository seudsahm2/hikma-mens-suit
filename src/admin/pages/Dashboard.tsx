import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, ChevronRight, CreditCard, FileText, PackageOpen, Truck, TriangleAlert } from 'lucide-react';
import { ErrorState, Skeleton } from '../../components/ui';
import { birr, cn, num, timeAgo } from '../../lib/format';
import type { Order } from '../../lib/types';
import { useStaff } from '../../store/auth';
import { adminApi, Card, PaymentBadge, StatusBadge, Tabs, TapeAxis } from '../ui';

interface Analytics {
  days: number;
  revenue: number;
  orders: number;
  averageOrder: number;
  profit: number;
  collected: number;
  previous: { revenue: number; orders: number };
  today: { revenue: number; orders: number };
  attention: { paymentsToCheck: number; toPrepare: number; onTheWay: number; lowStock: number; drafts: number };
  byDay: { day: string; revenue: number; orders: number }[];
  topProducts: { productId: string; name: string; quantity: number; image: string | null }[];
  bySource: { source: 'WEB' | 'MINI_APP' | 'ADMIN' | 'COUNTER'; orders: number; revenue: number }[];
}

const SOURCE: Record<string, { label: string; color: string }> = {
  MINI_APP: { label: 'Telegram app', color: '#B98B57' },
  WEB: { label: 'Website', color: '#ECE9E3' },
  ADMIN: { label: 'Entered by staff', color: '#7F8894' },
  COUNTER: { label: 'In the shop', color: '#5E7A6A' },
};

function greeting() {
  // Addis Ababa time (UTC+3)
  const h = (new Date().getUTCHours() + 3) % 24;
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return <span className="font-mono text-xs text-steel">—</span>;
  if (!before) return <span className="font-mono text-xs text-ok">new</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-mono text-xs', up ? 'text-ok' : 'text-danger')}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(pct)}%
    </span>
  );
}

/** Sales per day, standing on the tailor's tape. */
function SalesChart({ data }: { data: Analytics['byDay'] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const step = data.length > 45 ? 14 : data.length > 10 ? 7 : 1;
  const lastIdx = data.length - 1;
  return (
    <div>
      <div className="relative h-44 md:h-56">
        {/* faint guide lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-seam/70" style={{ bottom: `${f * 100}%` }} aria-hidden />
        ))}
        <div className="absolute inset-0 grid items-end gap-[3px]" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d, i) => (
            <div key={d.day} className="group relative flex h-full items-end justify-center">
              <div
                className={cn(
                  'w-full max-w-[22px] rounded-t-[3px] transition-all duration-500',
                  i === lastIdx ? 'bg-chalk' : d.revenue ? 'bg-gradient-to-t from-camel/50 to-camel group-hover:to-camel-soft' : 'bg-seam/60',
                )}
                style={{ height: d.revenue ? `${Math.max(4, (d.revenue / max) * 100)}%` : '2px' }}
              />
              <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-seam bg-ink px-2.5 py-1.5 text-center group-hover:block">
                <p className="font-mono text-[0.65rem] text-steel">{new Date(d.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                <p className="font-mono text-xs">{birr(d.revenue)}</p>
                <p className="font-mono text-[0.65rem] text-steel">{d.orders} orders</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TapeAxis
        count={data.length}
        labels={(i) => ((data.length - 1 - i) % step === 0 ? String(new Date(data[i]!.day).getUTCDate()) : null)}
      />
    </div>
  );
}

function AttentionTile({ to, icon: Icon, label, count, urgent }: { to: string; icon: typeof CreditCard; label: string; count: number; urgent?: boolean }) {
  const hot = urgent && count > 0;
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex min-w-[9.5rem] flex-1 flex-col justify-between gap-6 overflow-hidden rounded-2xl border p-4 transition-colors',
        hot ? 'border-camel/50 bg-camel/[0.08] hover:bg-camel/[0.12]' : 'border-seam/80 bg-wool hover:border-steel/60',
      )}
    >
      {hot && <span className="absolute right-4 top-4 size-2 animate-pulse rounded-full bg-camel" aria-hidden />}
      <Icon className={cn('size-5', hot ? 'text-camel' : 'text-steel')} strokeWidth={1.6} />
      <div>
        <p className={cn('font-mono text-3xl tabular-nums', count === 0 && 'text-steel/70')}>{count}</p>
        <p className="mt-1 flex items-center gap-1 text-[0.8rem] text-steel group-hover:text-chalk">
          {label} <ChevronRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const user = useStaff((s) => s.user);
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: () => adminApi<Analytics>('/analytics', { query: { days } }),
    refetchInterval: 60_000,
  });
  const recent = useQuery({
    queryKey: ['admin', 'orders', 'recent'],
    queryFn: () => adminApi<{ orders: Order[] }>('/orders', { query: { limit: 6 } }).then((r) => r.orders),
    refetchInterval: 30_000,
  });

  if (error) return <ErrorState message="Couldn’t load the overview." onRetry={() => refetch()} />;

  const firstName = user?.fullName.split(' ')[0] ?? '';
  const a = data?.attention;
  const margin = data && data.revenue ? Math.round((data.profit / data.revenue) * 100) : 0;
  const sourceTotal = data?.bySource.reduce((n, s) => n + s.orders, 0) ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label !text-camel">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Addis_Ababa' })}
          </p>
          <h1 className="display mt-2 text-[1.75rem] md:text-[2.4rem]">
            {greeting()}
            {firstName && <span className="text-steel">, {firstName}</span>}
          </h1>
        </div>
        <Tabs
          value={days}
          onChange={setDays}
          tabs={[
            { value: '7', label: '7 days' },
            { value: '30', label: '30 days' },
            { value: '90', label: '90 days' },
          ]}
        />
      </div>

      {/* Hero: today + sales on the tape */}
      <Card>
        {isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-60" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="label">Today</p>
                <p className="mt-2 font-mono text-[2.6rem] leading-none tabular-nums md:text-[3.4rem]">
                  {num(data.today.revenue)}
                  <span className="ml-2 text-base text-steel">ETB</span>
                </p>
                <p className="mt-2 text-sm text-steel">
                  {data.today.orders} {data.today.orders === 1 ? 'order' : 'orders'} so far
                </p>
              </div>
              <div className="text-right">
                <p className="label">Last {data.days} days</p>
                <p className="mt-2 font-mono text-xl tabular-nums">{birr(data.revenue)}</p>
                <p className="mt-1">
                  <Delta now={data.revenue} before={data.previous.revenue} /> <span className="text-xs text-steel">vs previous {data.days} days</span>
                </p>
              </div>
            </div>
            <div className="mt-8">
              <SalesChart data={data.byDay} />
            </div>
          </>
        )}
      </Card>

      {/* Ledger strip */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-seam/80 bg-wool md:grid-cols-4 [&>*]:border-seam/80 [&>*:nth-child(odd)]:border-r md:[&>*]:border-r md:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b md:[&>*:nth-child(-n+2)]:border-b-0">
        {[
          { label: 'Orders', value: data ? num(data.orders) : '—', extra: data && <Delta now={data.orders} before={data.previous.orders} /> },
          { label: 'Average order', value: data ? num(data.averageOrder) : '—', extra: <span className="text-xs text-steel">ETB</span> },
          { label: 'Profit', value: data ? num(data.profit) : '—', extra: <span className="text-xs text-steel">{margin}% margin</span> },
          { label: 'Collected', value: data ? num(data.collected) : '—', extra: <span className="text-xs text-steel">ETB received</span> },
        ].map((s) => (
          <div key={s.label} className="p-5">
            <p className="label">{s.label}</p>
            <p className="mt-3 font-mono text-2xl tabular-nums">{s.value}</p>
            <div className="mt-1 h-4">{s.extra}</div>
          </div>
        ))}
      </div>

      {/* Needs you */}
      <section>
        <h2 className="label mb-3 !text-chalk/80">Needs you</h2>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <AttentionTile to="/admin/orders?tab=review" icon={CreditCard} label="Payments to check" count={a?.paymentsToCheck ?? 0} urgent />
          <AttentionTile to="/admin/orders" icon={PackageOpen} label="To prepare" count={a?.toPrepare ?? 0} urgent />
          <AttentionTile to="/admin/orders" icon={Truck} label="On the way" count={a?.onTheWay ?? 0} />
          <AttentionTile to="/admin/products?tab=low" icon={TriangleAlert} label="Low stock sizes" count={a?.lowStock ?? 0} urgent />
          <AttentionTile to="/admin/products?tab=draft" icon={FileText} label="Drafts" count={a?.drafts ?? 0} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Recent orders */}
        <Card
          title="Latest orders"
          flush
          action={
            <Link to="/admin/orders?tab=all" className="label inline-flex items-center gap-1 hover:!text-chalk">
              All <ArrowUpRight className="size-3" />
            </Link>
          }
        >
          {recent.data?.length ? (
            <ul className="mt-3 divide-y divide-seam/70">
              {recent.data.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-wool-2/60">
                    {o.items[0]?.image ? (
                      <img src={o.items[0].image} alt="" className="aspect-[4/5] w-10 rounded-md object-cover" />
                    ) : (
                      <div className="aspect-[4/5] w-10 rounded-md bg-wool-2" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{o.customerName}</p>
                      <p className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-[0.7rem] text-steel">{o.orderNumber}</span>
                        <PaymentBadge status={o.paymentStatus} />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">{num(o.total)}</p>
                      <p className="mt-0.5 text-[0.7rem] text-steel">{timeAgo(o.createdAt)}</p>
                    </div>
                    <span className="hidden sm:block">
                      <StatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-6 pt-4 text-sm text-steel">{recent.isLoading ? 'Loading…' : 'New orders show up here the moment they’re placed.'}</p>
          )}
        </Card>

        <div className="space-y-6">
          {/* Best sellers */}
          <Card title="Best sellers">
            {data?.topProducts.length ? (
              <ol className="space-y-3.5">
                {data.topProducts.map((p) => {
                  const top = data.topProducts[0]!.quantity || 1;
                  return (
                    <li key={p.productId}>
                      <Link to={`/admin/products/${p.productId}`} className="group flex items-center gap-3">
                        {p.image ? <img src={p.image} alt="" className="size-10 rounded-md object-cover" /> : <div className="size-10 rounded-md bg-wool-2" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm group-hover:text-camel">{p.name}</span>
                            <span className="font-mono text-xs text-steel">× {p.quantity}</span>
                          </div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-seam/70">
                            <div className="h-full rounded-full bg-camel" style={{ width: `${(p.quantity / top) * 100}%` }} />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-steel">Your best sellers appear after the first orders.</p>
            )}
          </Card>

          {/* Channel mix */}
          <Card title="Where orders come from">
            {sourceTotal ? (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-seam/70">
                  {data!.bySource.map((s) => (
                    <div key={s.source} style={{ width: `${(s.orders / sourceTotal) * 100}%`, background: SOURCE[s.source]?.color }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {data!.bySource.map((s) => (
                    <li key={s.source} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: SOURCE[s.source]?.color }} />
                        {SOURCE[s.source]?.label ?? s.source}
                      </span>
                      <span className="font-mono text-xs text-steel">
                        {s.orders} · {birr(s.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-steel">Telegram app vs website, once orders come in.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
