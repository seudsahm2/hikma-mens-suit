/** Delivery people: add, connect to Telegram, assign to orders. */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Check, Copy, MapPin, Package, Phone, Plus, Zap } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/format';
import type { Order } from '../../lib/types';
import { adminApi, Card } from '../ui';

export interface DriverRow {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  linked: boolean;
  linkCode: string | null;
  isOnline: boolean;
  busy: boolean;
  /** location shared in the last 30 minutes */
  live: boolean;
  distanceKm: number | null;
  locationAt: string | null;
  mapUrl: string | null;
}

/** "Online · 1.2 km from the shop" */
export function driverStatus(d: DriverRow) {
  if (!d.linked) return { text: 'Not connected', tone: 'text-camel' };
  if (!d.isOnline) return { text: 'Offline', tone: 'text-steel' };
  if (d.busy) return { text: 'Busy with a delivery', tone: 'text-camel' };
  const where = d.distanceKm !== null ? ` · ${d.distanceKm} km from the shop${d.live ? '' : ' (old)'}` : ' · location not shared';
  return { text: `Available${where}`, tone: 'text-ok' };
}

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Failed');
export const useDrivers = () => useQuery({ queryKey: ['admin', 'drivers'], queryFn: () => adminApi<{ drivers: DriverRow[] }>('/drivers').then((r) => r.drivers) });

/** Settings → Delivery: the people who deliver. */
export function DriversSection({ botUsername }: { botUsername: string }) {
  const qc = useQueryClient();
  const q = useDrivers();
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
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { isActive?: boolean; newCode?: boolean } }) => adminApi(`/drivers/${id}`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });

  return (
    <section>
      <h2 className="label mb-2.5 px-1">Delivery people</h2>
      <div className="divide-y divide-seam/60 overflow-hidden rounded-2xl border border-seam/80 bg-gradient-to-b from-wool-2/60 to-wool">
        {(q.data ?? []).map((d) => (
          <div key={d.id} className={cn('px-4 py-3.5', !d.isActive && 'opacity-50')}>
            <div className="flex items-center gap-4">
              <span className="grid size-10 place-items-center rounded-xl bg-camel/15 text-camel">
                <Bike className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">{d.name}</span>
                <span className="block font-mono text-xs text-steel">{d.phone}</span>
              </span>
              <span className={cn('text-right text-xs', driverStatus(d).tone)}>
                ● {driverStatus(d).text}
                {d.mapUrl && (
                  <a href={d.mapUrl} target="_blank" rel="noreferrer" className="ml-2 text-steel underline underline-offset-2 hover:text-chalk">
                    map
                  </a>
                )}
              </span>
            </div>
            {!d.linked && d.linkCode && d.isActive && (
              <div className="mt-3 rounded-xl bg-ink/50 p-3 text-xs text-steel">
                Ask {d.name.split(' ')[0]} to open <b className="text-chalk">@{botUsername}</b>, tap Start and send:
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(`/driver ${d.linkCode}`);
                    toast.ok('Copied');
                  }}
                  className="mt-2 flex items-center gap-2 rounded-lg border border-camel/40 px-3 py-2 font-mono text-base text-chalk"
                >
                  /driver {d.linkCode} <Copy className="size-4 text-steel" />
                </button>
              </div>
            )}
            <div className="mt-2 flex justify-end gap-3 text-xs">
              {d.linked && (
                <button onClick={() => patch.mutate({ id: d.id, body: { newCode: true } })} className="text-steel hover:text-chalk">
                  Reconnect (new phone)
                </button>
              )}
              <button onClick={() => patch.mutate({ id: d.id, body: { isActive: !d.isActive } })} className="text-steel hover:text-chalk">
                {d.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
        {adding ? (
          <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Input name="dname" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input name="dphone" label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button variant="accent" loading={add.isPending} disabled={name.trim().length < 2 || phone.trim().length < 9} onClick={() => add.mutate()}>
              Add
            </Button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-white/[0.02]">
            <span className="grid size-10 place-items-center rounded-xl bg-chalk text-ink">
              <Plus className="size-4" />
            </span>
            Add a delivery person
          </button>
        )}
      </div>
      <p className="mt-2 px-1 text-xs leading-relaxed text-steel">
        Drivers send /online in the bot and share their live location. “Find nearest driver” offers the job to the closest free driver; they accept with an arrival time.
        When they take the items you tap “Handed over” — the customer gets the delivery code, and the driver types it at the door.
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
            <Button variant="accent" block className="mt-4" loading={hand.isPending} onClick={() => hand.mutate()}>
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
