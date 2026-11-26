/** Delivery people: add, connect to Telegram, assign to orders. */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Banknote, Bike, Check, ChevronRight, Copy, MapPin, Package, Phone, Plus, Send, ShieldCheck, Star, Zap } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, cn } from '../../lib/format';
import type { Order } from '../../lib/types';
import { adminApi, Card } from '../ui';
import { useStaff } from '../../store/auth';

export interface DriverRow {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  linked: boolean;
  linkCode: string | null;
  isOnline: boolean;
  busy: boolean;
  /** the order keeping the driver busy */
  busyWith?: { id: string; orderNumber: string } | null;
  rating?: { avg: number; count: number } | null;
  /** location shared in the last 30 minutes */
  live: boolean;
  distanceKm: number | null;
  locationAt: string | null;
  mapUrl: string | null;
  /** cash collected on deliveries, not yet handed to the shop */
  cash?: { amount: number; orders: { orderNumber: string; amount: number; at: string }[] };
}

/** "Online · 1.2 km from the shop" */
export function driverStatus(d: DriverRow) {
  if (!d.linked) return { text: 'Not connected', tone: 'text-camel' };
  // A driver carrying an order is busy even if they switched to offline
  if (d.busy) return { text: d.busyWith ? `Busy · ${d.busyWith.orderNumber}` : 'Busy with a delivery', tone: 'text-camel' };
  if (!d.isOnline) return { text: 'Offline', tone: 'text-steel' };
  const where = d.distanceKm !== null ? ` · ${d.distanceKm} km from the shop${d.live ? '' : ' (old)'}` : ' · location not shared';
  return { text: `Available${where}`, tone: 'text-ok' };
}

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Failed');
export const useDrivers = () => useQuery({ queryKey: ['admin', 'drivers'], queryFn: () => adminApi<{ drivers: DriverRow[] }>('/drivers').then((r) => r.drivers) });

/** Owner: which delivery people / admins have a verified Fayda ID (for the ✓ badges). */
export const useIdentitySummary = (enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'identity-summary'], queryFn: () => adminApi<{ driver: string[]; staff: string[] }>('/identity-summary'), enabled, staleTime: 60_000 });

const STATUS_STYLE = {
  ok: { dot: 'bg-ok', ring: 'ring-ok/70', text: 'text-ok' },
  busy: { dot: 'bg-camel', ring: 'ring-camel/80', text: 'text-camel' },
  off: { dot: 'bg-steel/60', ring: 'ring-seam', text: 'text-steel' },
  new: { dot: 'bg-camel/60', ring: 'ring-camel/40', text: 'text-camel' },
} as const;

function statusKind(d: DriverRow): keyof typeof STATUS_STYLE {
  if (!d.linked) return 'new';
  if (d.busy) return 'busy';
  return d.isOnline ? 'ok' : 'off';
}

/** Avatar with a status ring (green = free, camel = busy, grey = offline). */
export function DriverAvatar({ name, kind, size = 'md' }: { name: string; kind: keyof typeof STATUS_STYLE; size?: 'md' | 'lg' }) {
  const s = STATUS_STYLE[kind];
  return (
    <span className="relative shrink-0">
      <span
        className={cn(
          'grid place-items-center rounded-full bg-gradient-to-br from-wool-2 to-ink font-display font-bold text-chalk ring-2 ring-offset-2 ring-offset-wool',
          s.ring,
          size === 'lg' ? 'size-20 text-3xl' : 'size-12 text-lg',
        )}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className={cn('absolute bottom-0 right-0 rounded-full ring-2 ring-wool', s.dot, size === 'lg' ? 'size-5' : 'size-3.5', kind === 'ok' && 'animate-pulse')} />
    </span>
  );
}

/** Settings → Delivery: the people who deliver. */
export function DriversSection({ botUsername }: { botUsername: string }) {
  const qc = useQueryClient();
  const q = useDrivers();
  const isOwner = useStaff((s) => s.user?.role === 'OWNER');
  const ids = useIdentitySummary(isOwner);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'drivers'] });
  const add = useMutation({
    mutationFn: () => adminApi('/drivers', { body: { name, phone } }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setAdding(false);
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const received = useMutation({
    mutationFn: (id: string) => adminApi<{ amount: number }>(`/drivers/${id}/cash/received`, { body: {} }),
    onSuccess: (r) => {
      toast.ok(r.amount ? `Received ${birr(r.amount)}` : 'Nothing to receive');
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { isActive?: boolean; newCode?: boolean } }) => adminApi(`/drivers/${id}`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });

  const list = q.data ?? [];
  const online = list.filter((d) => d.isActive && statusKind(d) === 'ok').length;
  const busy = list.filter((d) => d.isActive && statusKind(d) === 'busy').length;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <h2 className="label">Delivery people</h2>
        {list.length > 0 && (
          <div className="flex gap-2 text-[0.7rem]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2.5 py-1 text-ok">
              <span className="size-1.5 rounded-full bg-ok" /> {online} free
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-camel/10 px-2.5 py-1 text-camel">
              <span className="size-1.5 rounded-full bg-camel" /> {busy} busy
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {list.map((d) => {
          const kind = statusKind(d);
          const st = driverStatus(d);
          const verified = ids.data?.driver.includes(d.id);
          return (
            <article key={d.id} className={cn('overflow-hidden rounded-3xl border border-seam/80 bg-gradient-to-br from-wool-2/70 via-wool to-wool', !d.isActive && 'opacity-50')}>
              {/* Whole top row → profile */}
              <Link to={`/admin/drivers/${d.id}`} className="group flex items-center gap-4 p-4">
                <DriverAvatar name={d.name} kind={kind} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-medium group-hover:text-camel">{d.name}</p>
                    {verified && <ShieldCheck className="size-4 shrink-0 text-ok" aria-label="Fayda ID verified" />}
                    {d.rating && d.rating.avg >= 4.5 && d.rating.count >= 3 && <span className="shrink-0 rounded-full bg-camel px-1.5 py-px text-[0.58rem] font-bold tracking-wide text-ink">TOP</span>}
                  </div>
                  <p className={cn('mt-0.5 truncate text-xs', STATUS_STYLE[kind].text)}>{st.text}</p>
                  <p className="mt-1 flex items-center gap-3 font-mono text-[0.7rem] text-steel">
                    <span>{d.phone}</span>
                    {d.rating && (
                      <span className="inline-flex items-center gap-1 text-camel">
                        <Star className="size-3 fill-camel" /> {d.rating.avg}
                        <span className="text-steel">({d.rating.count})</span>
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-steel transition-transform group-hover:translate-x-0.5 group-hover:text-chalk" />
              </Link>

              {(d.cash?.amount ?? 0) > 0 && (
                <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-camel/30 bg-camel/[0.07] p-3">
                  <Banknote className="size-5 shrink-0 text-camel" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      Holding <b className="font-mono">{birr(d.cash!.amount)}</b>
                    </p>
                    <p className="truncate text-[0.7rem] text-steel">{d.cash!.orders.map((o) => o.orderNumber).join(' · ')}</p>
                  </div>
                  <button
                    onClick={() => window.confirm(`Did ${d.name} hand over ${birr(d.cash!.amount)}?`) && received.mutate(d.id)}
                    disabled={received.isPending}
                    className="shrink-0 rounded-full bg-camel px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                  >
                    Received
                  </button>
                </div>
              )}

              {!d.linked && d.linkCode && d.isActive && (
                <div className="mx-4 mb-3 rounded-2xl border border-[#2AABEE]/30 bg-[#2AABEE]/[0.06] p-3">
                  <p className="text-xs text-steel">
                    Not connected — send {d.name.split(' ')[0]} the invite; they tap it and press <b className="text-chalk">Start</b>.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${botUsername}?start=drv_${d.linkCode}`)}&text=${encodeURIComponent('Hikma deliveries — tap to connect:')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#2AABEE] text-xs font-semibold text-white"
                    >
                      <Send className="size-3.5" /> Send invite
                    </a>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(`https://t.me/${botUsername}?start=drv_${d.linkCode}`);
                        toast.ok('Invite link copied');
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-seam px-3 text-xs"
                    >
                      <Copy className="size-3.5" /> Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1 border-t border-seam/50 px-2 py-1.5 text-[0.72rem] text-steel">
                <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-ink/40 hover:text-chalk">
                  <Phone className="size-3.5" /> Call
                </a>
                {d.mapUrl && (
                  <a href={d.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-ink/40 hover:text-chalk">
                    <MapPin className="size-3.5" /> {d.live ? 'Live' : 'Last'} location
                  </a>
                )}
                <span className="ml-auto flex">
                  {d.linked && (
                    <button onClick={() => patch.mutate({ id: d.id, body: { newCode: true } })} className="rounded-full px-3 py-1.5 hover:bg-ink/40 hover:text-chalk" title="New phone? Send a fresh invite">
                      Reconnect
                    </button>
                  )}
                  <button onClick={() => patch.mutate({ id: d.id, body: { isActive: !d.isActive } })} className="rounded-full px-3 py-1.5 hover:bg-ink/40 hover:text-chalk">
                    {d.isActive ? 'Pause' : 'Activate'}
                  </button>
                </span>
              </div>
            </article>
          );
        })}

        {adding ? (
          <div className="rounded-3xl border border-camel/40 bg-wool p-4">
            <p className="mb-3 text-sm font-medium">New delivery person</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="dname" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input name="dphone" label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button variant="accent" loading={add.isPending} disabled={name.trim().length < 2 || phone.trim().length < 9} onClick={() => add.mutate()}>
                Add
              </Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-seam py-4 text-sm text-steel transition-colors hover:border-camel hover:text-camel">
            <Plus className="size-4" /> Add a delivery person
          </button>
        )}
      </div>
      <p className="mt-3 px-1 text-xs leading-relaxed text-steel">
        Drivers tap 🟢 Online in the bot and share their live location. “Choose a driver” lists the nearest free ones; when they arrive you tap “Handed over”, and they type the customer’s code at the door.
      </p>
    </section>
  );
}

interface DispatchState {
  offer: { id: string; status: 'offered' | 'accepted' | 'declined' | 'expired' | 'cancelled' | 'completed'; auto: boolean; etaMinutes: number | null; expiresAt: string; respondedAt: string | null; driverName: string; driverPhone: string } | null;
  tried: number;
  driver: { id: string; name: string; phone: string; locationAt: string | null; live: boolean; mapUrl: string | null; distanceKm: number | null } | null;
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return <span className="font-mono">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>;
}

/** Order page: offer the job → driver accepts → hand over → on the way (→ code at the door). */
export function DriverCard({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const qc = useQueryClient();
  const drivers = useDrivers();
  const state = useQuery({
    queryKey: ['admin', 'dispatch', order.id],
    queryFn: () => adminApi<DispatchState>(`/orders/${order.id}/dispatch`),
    refetchInterval: 8000,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'dispatch', order.id] });
    void qc.invalidateQueries({ queryKey: ['admin', 'drivers'] });
  };
  const offer = useMutation({
    mutationFn: (driverId?: string) => adminApi(`/orders/${order.id}/dispatch`, { body: driverId ? { driverId } : {} }),
    onSuccess: () => {
      toast.ok('Job offered — waiting for the driver');
      refresh();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const cancel = useMutation({ mutationFn: () => adminApi(`/orders/${order.id}/dispatch/cancel`, { body: {} }), onSuccess: refresh });
  const hand = useMutation({
    mutationFn: () => adminApi<{ order: Order }>(`/orders/${order.id}/handover`, { body: {} }),
    onSuccess: (r) => {
      onChange(r.order);
      refresh();
      toast.ok('On the way — the customer has the delivery code');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (order.delivery.optionId === 'pickup' || ['DELIVERED', 'PICKED_UP', 'CANCELLED'].includes(order.status)) return null;
  const st = state.data;
  const o = st?.offer;
  const list = (drivers.data ?? []).filter((d) => d.isActive && d.linked);

  // On the way
  if (order.status === 'OUT_FOR_DELIVERY') {
    const d = st?.driver;
    return (
      <Card title="Delivery">
        <p className="flex items-center gap-2 text-sm">
          <Bike className="size-4 text-camel" /> <b>{d?.name ?? 'Driver'}</b> is on the way to the customer
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {d?.mapUrl && (
            <a href={d.mapUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-seam px-3 text-sm hover:border-steel">
              <MapPin className="size-4" /> Track {d.live ? 'live' : '(last seen)'}
            </a>
          )}
          {d && (
            <a href={`tel:${d.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-seam px-3 text-sm hover:border-steel">
              <Phone className="size-4" /> Call {d.name.split(' ')[0]}
            </a>
          )}
        </div>
        <p className="mt-3 text-xs text-steel">It becomes delivered when {d?.name.split(' ')[0] ?? 'the driver'} types the customer’s code at the door.</p>
      </Card>
    );
  }

  // Offered / accepted
  if (o && (o.status === 'offered' || o.status === 'accepted')) {
    return (
      <Card title="Delivery">
        {o.status === 'offered' ? (
          <>
            <p className="flex items-center gap-2 text-sm">
              <span className="size-2 animate-pulse rounded-full bg-camel" /> Waiting for <b>{o.driverName}</b> to accept · <Countdown until={o.expiresAt} />
            </p>
            <p className="mt-1 text-xs text-steel">{o.auto ? 'If they don’t answer, the next nearest driver gets it automatically.' : 'If they don’t answer, you’ll be told to pick another driver.'}</p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm text-ok">
              <Check className="size-4" /> <b>{o.driverName}</b> accepted · at the shop in ~{o.etaMinutes} min
            </p>
            <Button variant="accent" block className="mt-4" loading={hand.isPending} onClick={() => window.confirm(`Does ${o.driverName} have the items? The customer gets their delivery code now.`) && hand.mutate()}>
              <Package className="size-4" /> Handed to {o.driverName.split(' ')[0]} — start delivery
            </Button>
            <p className="mt-2 text-xs text-steel">Tap when the driver has the items. The customer then gets the delivery code.</p>
          </>
        )}
        <div className="mt-3 flex justify-between">
          <a href={`tel:${o.driverPhone}`} className="inline-flex items-center gap-1.5 text-xs text-steel hover:text-chalk">
            <Phone className="size-3.5" /> {o.driverPhone}
          </a>
          <button onClick={() => window.confirm('Take the job back from this driver?') && cancel.mutate()} className="text-xs text-steel underline underline-offset-2 hover:text-danger">
            Cancel driver
          </button>
        </div>
      </Card>
    );
  }

  // No driver yet
  return (
    <Card title="Delivery">
      {!list.length ? (
        <p className="text-sm text-steel">Add delivery people in Settings → Delivery.</p>
      ) : (
        <>
          <Button variant="accent" block loading={offer.isPending && offer.variables === undefined} onClick={() => offer.mutate(undefined)}>
            <Zap className="size-4" /> Find nearest driver
          </Button>
          {o && (o.status === 'declined' || o.status === 'expired') && (
            <p className="mt-2 text-xs text-camel">
              {o.driverName} {o.status === 'declined' ? 'couldn’t take it' : 'didn’t answer'}
              {st && st.tried > 1 ? ` · ${st.tried} drivers tried` : ''}.
            </p>
          )}
          <p className="label mb-2 mt-5">Or choose</p>
          <ul className="space-y-1.5">
            {list.map((d) => {
              const s = driverStatus(d);
              return (
                <li key={d.id}>
                  <button
                    disabled={offer.isPending}
                    onClick={() => offer.mutate(d.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-seam/70 px-3 py-2.5 text-left transition-colors hover:border-steel disabled:opacity-50"
                  >
                    <Bike className="size-4 text-camel" />
                    <span className="flex-1 text-sm">{d.name}</span>
                    <span className={cn('text-xs', s.tone)}>{s.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
