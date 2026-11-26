/** One delivery person: what they're doing now, how they perform, and every delivery they made. */
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, MapPin, Package, Phone, Star } from 'lucide-react';
import { ErrorState, PageLoader } from '../../components/ui';
import { birr, cn, formatDate, formatDateTime } from '../../lib/format';
import { adminApi, Card } from '../ui';
import { useStaff } from '../../store/auth';
import { FaydaIdentity } from './FaydaIdentity';

interface Profile {
  driver: { id: string; name: string; phone: string; isActive: boolean; linked: boolean; isOnline: boolean; since: string; locationAt: string | null; mapUrl: string | null };
  stats: {
    deliveredAll: number;
    deliveredWeek: number;
    deliveredMonth: number;
    rating: number | null;
    ratingCount: number;
    avgMinutes: number | null;
    accepted: number;
    declined: number;
    missed: number;
    cashHolding: number;
    cashOrders: number;
    valueDelivered: number;
  };
  current: null | {
    id: string;
    orderNumber: string;
    stage: 'on_the_way' | 'coming_to_shop' | 'offered';
    customerName: string;
    customerPhone: string;
    address: string;
    mapUrl: string | null;
    items: { name: string; size: string | null; color: string | null; quantity: number }[];
    total: number;
    toCollect: number;
    etaMinutes: number | null;
    handedAt: string | null;
  };
  history: { id: string; orderNumber: string; customerName: string; area: string; total: number; collected: number; at: string; minutes: number | null; rating: number | null; note: string | null }[];
}

const STAGE = { on_the_way: 'On the way to the customer', coming_to_shop: 'Coming to the shop to pick up', offered: 'Job offered — waiting for an answer' };

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <span className={cn('inline-flex', size === 'lg' ? 'gap-0.5' : 'gap-px')} aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size === 'lg' ? 'size-4' : 'size-3', n <= Math.round(value) ? 'fill-camel text-camel' : 'text-seam')} />
      ))}
    </span>
  );
}

export default function DriverProfile() {
  const { id } = useParams();
  const isOwner = useStaff((s) => s.user?.role === 'OWNER');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'driver', id],
    queryFn: () => adminApi<Profile>(`/drivers/${id}/profile`),
    refetchInterval: 30_000,
  });
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message="Couldn’t load this driver." onRetry={() => refetch()} />;
  const { driver: d, stats: s, current: c, history } = data;
  const topRated = s.rating !== null && s.rating >= 4.5 && s.ratingCount >= 3;
  const outFor = c?.handedAt ? Math.round((Date.now() - new Date(c.handedAt).getTime()) / 60_000) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/admin/settings?tab=delivery" className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-chalk">
        <ArrowLeft className="size-4" /> Delivery people
      </Link>

      {/* Who */}
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-camel font-display text-2xl font-bold text-ink">{d.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="display truncate text-[1.6rem]">{d.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-steel">
            <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1 hover:text-chalk">
              <Phone className="size-3.5" /> {d.phone}
            </a>
            <span>Since {formatDate(d.since)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn('rounded-full px-2.5 py-1', c ? 'bg-camel/15 text-camel' : d.isOnline ? 'bg-ok/15 text-ok' : 'bg-wool-2 text-steel')}>
              ● {c ? 'Busy' : d.isOnline ? 'Online' : 'Offline'}
            </span>
            {s.rating !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-wool-2 px-2.5 py-1">
                <Stars value={s.rating} /> {s.rating} · {s.ratingCount}
              </span>
            )}
            {topRated && <span className="rounded-full bg-camel px-2.5 py-1 font-semibold text-ink">Top rated</span>}
          </div>
        </div>
      </div>

      {/* Now */}
      {c && (
        <Card title="Now">
          <p className="flex items-center gap-2 text-sm font-medium text-camel">
            <span className="size-2 animate-pulse rounded-full bg-camel" /> {STAGE[c.stage]}
            {outFor !== null && <span className="text-steel">· out for {outFor} min</span>}
            {c.stage === 'coming_to_shop' && c.etaMinutes && <span className="text-steel">· said ~{c.etaMinutes} min</span>}
          </p>
          <Link to={`/admin/orders/${c.id}`} className="mt-3 block font-mono text-lg hover:text-camel">
            {c.orderNumber} ›
          </Link>
          <div className="mt-3 space-y-2 text-sm">
            <p>
              <b>{c.customerName}</b> ·{' '}
              <a href={`tel:${c.customerPhone}`} className="text-camel">
                {c.customerPhone}
              </a>
            </p>
            <p className="flex items-start gap-2 text-steel">
              <MapPin className="mt-0.5 size-4 shrink-0" /> {c.address}
              {c.mapUrl && (
                <a href={c.mapUrl} target="_blank" rel="noreferrer" className="shrink-0 text-camel underline underline-offset-2">
                  map
                </a>
              )}
            </p>
            <ul className="space-y-1">
              {c.items.map((i, n) => (
                <li key={n} className="flex items-center gap-2 text-steel">
                  <Package className="size-3.5" /> {i.name}
                  {[i.size, i.color].filter(Boolean).length ? ` · ${[i.size, i.color].filter(Boolean).join(' / ')}` : ''} × {i.quantity}
                </li>
              ))}
            </ul>
            <p className="pt-1 font-mono">{c.toCollect > 0 ? <span className="text-camel">💵 Collects {birr(c.toCollect)}</span> : <span className="text-ok">✓ Already paid</span>}</p>
          </div>
        </Card>
      )}

      {isOwner && <FaydaIdentity subject={{ type: 'driver', id: d.id, name: d.name }} />}

      {/* How they do */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['This week', s.deliveredWeek],
          ['This month', s.deliveredMonth],
          ['All time', s.deliveredAll],
          ['Avg. delivery', s.avgMinutes !== null ? `${s.avgMinutes} min` : '—'],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border border-seam/80 bg-wool p-4">
            <p className="label !text-[0.6rem]">{label}</p>
            <p className="mt-1 font-mono text-2xl">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-2xl border border-seam/80 bg-wool p-3">
          <p className="font-mono text-lg text-ok">{s.accepted}</p>
          <p className="text-xs text-steel">jobs taken</p>
        </div>
        <div className="rounded-2xl border border-seam/80 bg-wool p-3">
          <p className="font-mono text-lg">{s.declined}</p>
          <p className="text-xs text-steel">said “can’t”</p>
        </div>
        <div className="rounded-2xl border border-seam/80 bg-wool p-3">
          <p className={cn('font-mono text-lg', s.missed > 2 && 'text-camel')}>{s.missed}</p>
          <p className="text-xs text-steel">didn’t answer</p>
        </div>
      </div>
      {s.cashHolding > 0 && (
        <p className="rounded-2xl border border-camel/30 bg-camel/[0.06] p-4 text-sm">
          💵 Holding <b className="font-mono">{birr(s.cashHolding)}</b> from {s.cashOrders} order{s.cashOrders === 1 ? '' : 's'} — mark it received in Settings → Delivery.
        </p>
      )}

      {/* Every delivery */}
      <Card title={`Deliveries · ${birr(s.valueDelivered)} delivered`}>
        {history.length ? (
          <ul className="divide-y divide-seam/60">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/orders/${h.id}`} className="font-mono text-sm hover:text-camel">
                    {h.orderNumber}
                  </Link>
                  <p className="truncate text-xs text-steel">
                    {h.customerName}
                    {h.area && ` · ${h.area}`}
                  </p>
                  {h.note && <p className="mt-1 text-xs italic text-steel">“{h.note}”</p>}
                </div>
                <div className="shrink-0 text-right text-xs">
                  {h.rating ? <Stars value={h.rating} /> : <span className="text-steel">not rated</span>}
                  <p className="mt-1 text-steel">
                    {formatDateTime(h.at)}
                    {h.minutes !== null && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        · <Clock className="size-3" /> {h.minutes}m
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-steel">No deliveries yet.</p>
        )}
      </Card>
    </div>
  );
}
