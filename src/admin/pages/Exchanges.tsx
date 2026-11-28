import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, PackageCheck, RefreshCw, Truck, X } from 'lucide-react';
import { Button, PageLoader } from '../../components/ui';
import { Dropdown } from '../../components/ui/Dropdown';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, cn, formatDateTime } from '../../lib/format';
import { adminApi, PageHeader, Tabs } from '../ui';

interface VariantChoice {
  id: string;
  size: string;
  color: string;
  stock: number;
}

interface Ex {
  id: string;
  orderId: string;
  items: { orderItemId: string; name: string; size: string; wantSize: string | null; wantVariantId?: string | null; choices?: VariantChoice[] }[];
  reason: 'too_small' | 'too_big' | 'wrong_scent' | 'damaged_bottle' | 'wrong_item' | 'defect' | 'other';
  note: string | null;
  status: 'requested' | 'approved' | 'declined' | 'done';
  staffNote: string | null;
  replacementOrderId: string | null;
  deliveryFee: number | null;
  defaultDeliveryFee: number;
  returnStatus: 'pending' | 'returned_good' | 'returned_damaged' | 'restocked';
  damagePhotoUrl: string | null;
  damageFee: number;
  damagePaid: boolean;
  damageNote: string | null;
  createdAt: string;
  order: { orderNumber: string; customerName: string; customerPhone: string };
}

const REASON: Record<string, string> = {
  too_small: 'Too small',
  too_big: 'Too big',
  wrong_scent: 'Wrong scent',
  damaged_bottle: 'Damaged bottle',
  wrong_item: 'Wrong item',
  defect: 'Defect / damage',
  other: 'Other',
};

const STATUS = {
  requested: { label: 'Waiting for you', tone: 'text-camel' },
  approved: { label: 'Prepared — in delivery', tone: 'text-ok' },
  declined: { label: 'Declined', tone: 'text-steel' },
  done: { label: 'Done', tone: 'text-steel' },
};

function ExchangeCard({ e }: { e: Ex }) {
  const qc = useQueryClient();
  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const it of e.items) {
      if (it.wantVariantId) init[it.orderItemId] = it.wantVariantId;
      else if (it.wantSize) {
        const m = it.choices?.find((c) => c.size === it.wantSize && c.stock > 0) ?? it.choices?.find((c) => c.size === it.wantSize);
        if (m) init[it.orderItemId] = m.id;
      }
    }
    return init;
  });
  const [fee, setFee] = useState<string>(String(e.deliveryFee ?? e.defaultDeliveryFee ?? 0));
  const [pickupAtShop, setPickupAtShop] = useState(false);
  const [damageAmt, setDamageAmt] = useState<string>(String(e.damageFee || ''));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'exchanges'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'care-badge'] });
  };

  const decide = useMutation({
    mutationFn: ({ status, staffNote }: { status: 'approved' | 'declined' | 'done'; staffNote?: string }) =>
      adminApi(`/exchanges/${e.id}`, { method: 'PATCH', body: { status, staffNote } }),
    onSuccess: () => {
      toast.ok('Saved — the customer gets a Telegram message');
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const prepare = useMutation({
    mutationFn: () =>
      adminApi<{ replacementOrderId: string; replacementOrderNumber: string }>(`/exchanges/${e.id}/prepare`, {
        body: {
          items: e.items.map((it) => ({ orderItemId: it.orderItemId, variantId: picks[it.orderItemId] ?? '' })).filter((x) => x.variantId),
          deliveryFee: pickupAtShop ? 0 : Math.max(0, Number(fee) || 0),
          pickupAtShop,
        },
      }),
    onSuccess: (r) => {
      toast.ok(pickupAtShop ? `Prepared ${r.replacementOrderNumber} for shop pickup` : `Replacement ${r.replacementOrderNumber} created — ready for driver dispatch`);
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const restock = useMutation({
    mutationFn: () => adminApi(`/exchanges/${e.id}/restock`, { body: {} }),
    onSuccess: () => {
      toast.ok('Returned item restocked (+1)');
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const setDamage = useMutation({
    mutationFn: () => adminApi(`/exchanges/${e.id}/damage-fee`, { body: { amount: Math.max(0, Number(damageAmt) || 0) } }),
    onSuccess: () => {
      toast.ok('Damage fee sent to customer');
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const markDamagePaid = useMutation({
    mutationFn: () => adminApi(`/exchanges/${e.id}/damage-paid`, { body: {} }),
    onSuccess: () => {
      toast.ok('Marked damage fee paid');
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const allPicked = e.items.every((it) => Boolean(picks[it.orderItemId]));

  return (
    <li className="rounded-2xl border border-seam/80 bg-wool p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to={`/admin/orders/${e.orderId}`} className="font-mono text-sm hover:text-camel">
            {e.order.orderNumber}
          </Link>
          {e.replacementOrderId && (
            <Link to={`/admin/orders/${e.replacementOrderId}`} className="inline-flex items-center gap-1 rounded-full bg-camel/15 px-2.5 py-0.5 text-xs text-camel hover:bg-camel/25">
              <Truck className="size-3" /> Dispatch driver →
            </Link>
          )}
        </div>
        <span className={cn('text-xs', STATUS[e.status].tone)}>{STATUS[e.status].label}</span>
      </div>

      <ul className="mt-3 space-y-2 text-sm">
        {e.items.map((i) => (
          <li key={i.orderItemId} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <RefreshCw className="size-3.5 text-camel" />
              <span>{i.name}</span>
              <span className="font-mono text-steel">{i.size}</span>
              {i.wantSize && (
                <>
                  →<span className="font-mono font-semibold">{i.wantSize}</span>
                </>
              )}
            </div>
            {!e.replacementOrderId && e.status !== 'declined' && e.status !== 'done' && i.choices && i.choices.length > 0 && (
              <div className="pl-5">
                <Dropdown
                  value={picks[i.orderItemId] ?? ''}
                  onChange={(v) => setPicks((p) => ({ ...p, [i.orderItemId]: v }))}
                  options={[
                    { value: '', label: 'Choose replacement size/variant' },
                    ...i.choices.map((c) => ({
                      value: c.id,
                      label: `${c.size}${c.color ? ` · ${c.color}` : ''} (${c.stock} in stock)`,
                    })),
                  ]}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-steel">
        {REASON[e.reason] ?? e.reason}
        {e.note ? ` · “${e.note}”` : ''}
      </p>
      {e.staffNote && <p className="mt-1 text-xs text-chalk/70">You: {e.staffNote}</p>}

      {!e.replacementOrderId && e.status !== 'declined' && e.status !== 'done' && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-seam/70 bg-ink/30 p-3">
          <div className="flex rounded-full border border-seam p-0.5 text-xs">
            <button onClick={() => setPickupAtShop(false)} className={cn('h-7 rounded-full px-2.5', !pickupAtShop ? 'bg-chalk text-ink' : 'text-steel')}>
              Driver delivery
            </button>
            <button onClick={() => setPickupAtShop(true)} className={cn('h-7 rounded-full px-2.5', pickupAtShop ? 'bg-chalk text-ink' : 'text-steel')}>
              Shop pickup (G2)
            </button>
          </div>
          {!pickupAtShop && (
            <label className="text-xs text-steel">
              Fee (ETB):
              <input
                type="number"
                min={0}
                value={fee}
                onChange={(ev) => setFee(ev.target.value)}
                className="ml-2 h-8 w-20 rounded-lg border border-seam bg-wool px-2 font-mono text-sm text-chalk focus:border-camel focus:outline-none"
              />
            </label>
          )}
          <Button size="sm" variant="accent" disabled={!allPicked} loading={prepare.isPending} onClick={() => prepare.mutate()} className="ml-auto">
            <Check className="size-4" /> {pickupAtShop ? 'Prepare for pickup' : 'Prepare exchange delivery'}
          </Button>
        </div>
      )}

      {e.returnStatus === 'returned_good' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2 text-xs">
          <span className="text-ok">Old item returned in good condition</span>
          <Button size="sm" variant="primary" loading={restock.isPending} onClick={() => restock.mutate()}>
            <PackageCheck className="size-3.5" /> Restock (+1)
          </Button>
        </div>
      )}

      {e.returnStatus === 'returned_damaged' && (
        <div className="mt-3 space-y-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs">
          <p className="font-medium text-danger">Old item returned damaged</p>
          {e.damagePhotoUrl && (
            <a href={e.damagePhotoUrl} target="_blank" rel="noreferrer" className="block w-28 overflow-hidden rounded-lg border border-seam">
              <img src={e.damagePhotoUrl} alt="Damage" className="h-24 w-full object-cover" />
            </a>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="Damage fee (ETB)"
              value={damageAmt}
              onChange={(ev) => setDamageAmt(ev.target.value)}
              className="h-8 w-32 rounded-lg border border-seam bg-wool px-2 font-mono text-sm text-chalk focus:border-camel focus:outline-none"
            />
            <Button size="sm" variant="outline" loading={setDamage.isPending} onClick={() => setDamage.mutate()}>
              Set damage fee
            </Button>
            {e.damageFee > 0 && !e.damagePaid && (
              <Button size="sm" variant="accent" loading={markDamagePaid.isPending} onClick={() => markDamagePaid.mutate()}>
                Mark paid ({birr(e.damageFee)})
              </Button>
            )}
            {e.damagePaid && e.damageFee > 0 && <span className="text-ok">✓ Paid ({birr(e.damageFee)})</span>}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-steel">
          {e.order.customerName} · {e.order.customerPhone} · {formatDateTime(e.createdAt)}
        </span>
        <div className="flex gap-2">
          {e.status === 'requested' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const note = window.prompt('Reason for declining (optional):', '');
                  if (note !== null) decide.mutate({ status: 'declined', staffNote: note || undefined });
                }}
              >
                <X className="size-4" /> Decline
              </Button>
              {e.reason === 'other' && (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => {
                    const note = window.prompt('Message to the customer (optional):', '');
                    if (note !== null) decide.mutate({ status: 'approved', staffNote: note || undefined });
                  }}
                >
                  <Check className="size-4" /> Approve manually
                </Button>
              )}
            </>
          )}
          {e.status === 'approved' && e.returnStatus !== 'returned_good' && (
            <Button size="sm" variant="primary" onClick={() => decide.mutate({ status: 'done' })}>
              Mark exchanged
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Size exchanges asked for by customers (within the exchange window after receiving an order). */
export default function Exchanges({ embedded }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState<'requested' | 'approved' | 'all'>('requested');
  const q = useQuery({
    queryKey: ['admin', 'exchanges', tab],
    queryFn: () => adminApi<{ requests: Ex[]; open: number }>('/exchanges', { query: { status: tab === 'all' ? undefined : tab } }),
  });

  return (
    <div className={embedded ? '' : 'mx-auto max-w-3xl'}>
      {!embedded && <PageHeader title="Exchanges" kicker="Wrong size? Customers ask here" />}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'requested', label: 'Waiting', count: q.data?.open },
          { value: 'approved', label: 'Approved' },
          { value: 'all', label: 'All' },
        ]}
      />
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.requests.length ? (
        <p className="py-16 text-center text-sm text-steel">Nothing here.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {q.data.requests.map((e) => (
            <ExchangeCard key={e.id} e={e} />
          ))}
        </ul>
      )}
    </div>
  );
}
