/** Delivery people: add, connect to Telegram, assign to orders. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, Copy, Plus, Send } from 'lucide-react';
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
  onTheWay: number;
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
                <span className="block font-mono text-xs text-steel">
                  {d.phone}
                  {d.onTheWay ? ` · ${d.onTheWay} on the way` : ''}
                </span>
              </span>
              <span className={cn('text-xs', d.linked ? 'text-ok' : 'text-camel')}>{d.linked ? '● Telegram connected' : 'Not connected'}</span>
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
        Drivers get each order on Telegram with the customer’s phone, address and map. At the door they type the customer’s 4-digit delivery code — only then is the order marked
        delivered.
      </p>
    </section>
  );
}

/** Order page: who delivers this order. */
export function DriverCard({ order, onChange }: { order: Order; onChange: (o: Order) => void }) {
  const q = useDrivers();
  const set = useMutation({
    mutationFn: (driverId: string | null) => adminApi<{ order: Order }>(`/orders/${order.id}/driver`, { body: { driverId } }),
    onSuccess: (r, driverId) => {
      onChange(r.order);
      toast.ok(driverId ? 'Sent to the driver on Telegram' : 'Driver removed');
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (order.delivery.optionId === 'pickup' || ['DELIVERED', 'PICKED_UP', 'CANCELLED'].includes(order.status)) return null;
  const drivers = (q.data ?? []).filter((d) => d.isActive);
  const current = drivers.find((d) => d.id === order.driverId);
  return (
    <Card title="Delivery">
      {!drivers.length ? (
        <p className="text-sm text-steel">Add delivery people in Settings → Delivery.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {drivers.map((d) => (
              <button
                key={d.id}
                disabled={!d.linked || set.isPending}
                onClick={() => set.mutate(d.id === order.driverId ? null : d.id)}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors disabled:opacity-40',
                  d.id === order.driverId ? 'border-camel bg-camel text-ink' : 'border-seam text-steel hover:text-chalk',
                )}
                title={d.linked ? undefined : 'Not connected to Telegram yet'}
              >
                <Bike className="size-4" /> {d.name}
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-steel">
            <Send className="size-3.5" />
            {current ? `${current.name} has the order on Telegram. The customer has the delivery code.` : 'Tap a driver to send the order out — they get it on Telegram.'}
          </p>
        </>
      )}
    </Card>
  );
}
