/** One delivery person: what they're doing now, how they perform, their ID, and every delivery they made. */
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Check, Clock, MapPin, Package, Phone, ShieldCheck, Star, Timer, TrendingUp } from 'lucide-react';
import { ErrorState, PageLoader } from '../../components/ui';
import { birr, cn, formatDate, formatDateTime } from '../../lib/format';
import { adminApi } from '../ui';
import { useStaff } from '../../store/auth';
import { FaydaIdentity } from './FaydaIdentity';
import { DriverAvatar, useIdentitySummary } from './Drivers';

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

const STEPS = [
  { key: 'offered', label: 'Offered' },
  { key: 'coming_to_shop', label: 'Coming' },
  { key: 'on_the_way', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
] as const;

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <span className="inline-flex gap-px" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size === 'lg' ? 'size-4' : 'size-3', n <= Math.round(value) ? 'fill-camel text-camel' : 'text-seam')} />
      ))}
    </span>
  );
}

const Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section className={cn('rounded-3xl border border-seam/80 bg-wool p-5', className)}>{children}</section>
);

export default function DriverProfile() {
  const { id } = useParams();
  const isOwner = useStaff((s) => s.user?.role === 'OWNER');
  const ids = useIdentitySummary(isOwner);
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
  const kind = !d.linked ? 'new' : c ? 'busy' : d.isOnline ? 'ok' : 'off';
  const offers = s.accepted + s.declined + s.missed;
  const acceptRate = offers ? Math.round((s.accepted / offers) * 100) : null;
  const stepIndex = c ? STEPS.findIndex((x) => x.key === c.stage) : -1;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <Link to="/admin/settings?tab=delivery" className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-chalk">
        <ArrowLeft className="size-4" /> Delivery people
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-seam/80 bg-gradient-to-br from-wool-2 via-wool to-ink p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-camel/10 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <DriverAvatar name={d.name} kind={kind} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="display break-words text-[1.5rem] leading-tight sm:text-[1.8rem]">{d.name}</h1>
            <p className="mt-1 text-sm text-steel">
              {kind === 'busy' ? 'On a delivery' : kind === 'ok' ? 'Online · free' : kind === 'off' ? 'Offline' : 'Not connected yet'} · since {formatDate(d.since)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {s.rating !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/60 px-2.5 py-1">
                  <Stars value={s.rating} /> <b className="font-mono">{s.rating}</b> <span className="text-steel">({s.ratingCount})</span>
                </span>
              )}
              {topRated && <span className="rounded-full bg-camel px-2.5 py-1 font-semibold text-ink">Top rated</span>}
              {isOwner && ids.data?.driver.includes(d.id) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2.5 py-1 text-ok">
                  <ShieldCheck className="size-3.5" /> ID verified
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <a href={`tel:${d.phone}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-camel text-sm font-semibold text-ink">
            <Phone className="size-4" /> Call
          </a>
          {d.mapUrl ? (
            <a href={d.mapUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-seam text-sm hover:border-steel">
              <MapPin className="size-4" /> Location
            </a>
          ) : (
            <span className="inline-flex h-11 items-center justify-center rounded-full border border-seam/50 text-sm text-steel">No location shared</span>
          )}
        </div>
      </section>

      {/* Now */}
      {c && (
        <Panel className="border-camel/40 bg-gradient-to-b from-camel/[0.07] to-wool">
          <div className="flex items-center justify-between">
            <p className="label">Now</p>
            {outFor !== null && <span className="font-mono text-xs text-camel">out {outFor} min</span>}
            {c.stage === 'coming_to_shop' && c.etaMinutes && <span className="font-mono text-xs text-steel">~{c.etaMinutes} min to the shop</span>}
          </div>
          {/* Progress */}
          <ol className="mt-4 grid grid-cols-4 gap-1">
            {STEPS.map((step, i) => (
              <li key={step.key} className="text-center">
                <span className={cn('mx-auto block h-1.5 rounded-full', i <= stepIndex ? 'bg-camel' : 'bg-seam', i === stepIndex && 'animate-pulse')} />
                <span className={cn('mt-1.5 block text-[0.65rem]', i === stepIndex ? 'font-semibold text-camel' : i < stepIndex ? 'text-chalk' : 'text-steel')}>{step.label}</span>
              </li>
            ))}
          </ol>
          <Link to={`/admin/orders/${c.id}`} className="mt-5 flex items-center justify-between rounded-2xl bg-ink/50 px-4 py-3 hover:bg-ink/70">
            <span className="font-mono">{c.orderNumber}</span>
            <span className="text-xs text-steel">Open order ›</span>
          </Link>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-steel">Customer</p>
              <p className="mt-0.5">{c.customerName}</p>
              <a href={`tel:${c.customerPhone}`} className="font-mono text-sm text-camel">
                {c.customerPhone}
              </a>
            </div>
            <div>
              <p className="text-xs text-steel">Deliver to</p>
              <p className="mt-0.5">{c.address}</p>
              {c.mapUrl && (
                <a href={c.mapUrl} target="_blank" rel="noreferrer" className="text-xs text-camel underline underline-offset-2">
                  Open map
                </a>
              )}
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 border-t border-seam/50 pt-3 text-sm">
            {c.items.map((i, n) => (
              <li key={n} className="flex items-center gap-2 text-steel">
                <Package className="size-3.5 shrink-0" />
                <span className="truncate text-chalk">{i.name}</span>
                {[i.size, i.color].filter(Boolean).length > 0 && <span>· {[i.size, i.color].filter(Boolean).join(' / ')}</span>}
                <span className="ml-auto font-mono">×{i.quantity}</span>
              </li>
            ))}
          </ul>
          <p className={cn('mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm', c.toCollect > 0 ? 'bg-camel/15 text-camel' : 'bg-ok/15 text-ok')}>
            {c.toCollect > 0 ? (
              <>
                <Banknote className="size-4" /> Collects <b className="font-mono">{birr(c.toCollect)}</b>
              </>
            ) : (
              <>
                <Check className="size-4" /> Already paid
              </>
            )}
          </p>
        </Panel>
      )}

      {/* Performance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'This week', value: s.deliveredWeek, icon: TrendingUp },
          { label: 'This month', value: s.deliveredMonth, icon: Package },
          { label: 'All time', value: s.deliveredAll, icon: Check },
          { label: 'Avg. delivery', value: s.avgMinutes !== null ? `${s.avgMinutes}′` : '—', icon: Timer },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl border border-seam/80 bg-gradient-to-b from-wool-2/60 to-wool p-4">
            <Icon className="size-4 text-camel" />
            <p className="mt-3 font-mono text-[1.7rem] leading-none">{value}</p>
            <p className="mt-1.5 text-xs text-steel">{label}</p>
          </div>
        ))}
      </div>

      <Panel>
        <div className="flex items-baseline justify-between">
          <p className="label">Reliability</p>
          {acceptRate !== null && (
            <p className="text-sm">
              <b className="font-mono text-lg">{acceptRate}%</b> <span className="text-steel">of offers taken</span>
            </p>
          )}
        </div>
        {offers > 0 ? (
          <>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-ink">
              <span className="bg-ok" style={{ width: `${(s.accepted / offers) * 100}%` }} />
              <span className="bg-steel/60" style={{ width: `${(s.declined / offers) * 100}%` }} />
              <span className="bg-danger/80" style={{ width: `${(s.missed / offers) * 100}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-steel">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-ok" /> {s.accepted} taken
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-steel/60" /> {s.declined} said “can’t”
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-danger/80" /> {s.missed} didn’t answer
              </span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-steel">No job offers yet.</p>
        )}
        {s.cashHolding > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl border border-camel/30 bg-camel/[0.07] p-3 text-sm">
            <Banknote className="size-4 shrink-0 text-camel" /> Holding <b className="font-mono">{birr(s.cashHolding)}</b> from {s.cashOrders} order{s.cashOrders === 1 ? '' : 's'} — mark it received in Settings → Delivery.
          </p>
        )}
      </Panel>

      {isOwner && <FaydaIdentity subject={{ type: 'driver', id: d.id, name: d.name }} />}

      {/* Every delivery */}
      <Panel>
        <div className="flex items-baseline justify-between">
          <p className="label">Deliveries</p>
          <p className="font-mono text-xs text-steel">{birr(s.valueDelivered)} delivered</p>
        </div>
        {history.length ? (
          <ul className="mt-3 divide-y divide-seam/50">
            {history.map((h) => (
              <li key={h.id}>
                <Link to={`/admin/orders/${h.id}`} className="group flex items-start gap-3 py-3.5">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ok/10 text-ok">
                    <Check className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm group-hover:text-camel">{h.orderNumber}</span>
                      {h.rating ? <Stars value={h.rating} /> : <span className="text-[0.65rem] text-steel">not rated</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-steel">
                      {h.customerName}
                      {h.area && ` · ${h.area}`}
                    </span>
                    {h.note && <span className="mt-1 block text-xs italic text-chalk/80">“{h.note}”</span>}
                    <span className="mt-1 flex items-center gap-3 text-[0.68rem] text-steel">
                      <span>{formatDateTime(h.at)}</span>
                      {h.minutes !== null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" /> {h.minutes} min
                        </span>
                      )}
                      {h.collected > 0 && <span className="text-camel">💵 {birr(h.collected)}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-steel">No deliveries yet.</p>
        )}
      </Panel>
    </div>
  );
}
