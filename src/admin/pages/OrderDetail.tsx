import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Phone, Send } from 'lucide-react';
import { Button, ErrorState, Input, PageLoader, Textarea } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, cn, formatDateTime } from '../../lib/format';
import type { Order, OrderStatus } from '../../lib/types';
import { adminApi, Card, OrderPaymentBadge, StatusBadge, statusLabel } from '../ui';
import { DriverCard } from './Drivers';
import { ConfirmDelivered } from './ConfirmDelivered';
import { CancelCountdown } from './CancelCountdown';

/**
 * One step at a time (same rule as the server and the Telegram cards). "On the way" isn't here for
 * delivery orders — it happens through the Delivery card (driver accepts → Handed over).
 */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED'],
  CONFIRMED: ['PACKING'],
  PACKING: [],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  PICKED_UP: [],
  CANCELLED: [],
};

export default function OrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [confirmDelivered, setConfirmDelivered] = useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => adminApi<{ order: Order }>(`/orders/${id}`).then((r) => r.order),
  });

  const onDone = (o: Order, msg: string) => {
    qc.setQueryData(['admin', 'order', id], o);
    void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'badge'] });
    toast.ok(msg);
  };
  const onError = (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Failed');

  const status = useMutation({
    mutationFn: (s: OrderStatus) => adminApi<{ order: Order }>(`/orders/${id}/status`, { method: 'PATCH', body: { status: s } }),
    onSuccess: (r, s) => onDone(r.order, s === 'CANCELLED' ? 'Cancelling in 3 min — you can still undo it' : `Marked ${statusLabel(s).toLowerCase()}`),
    onError,
  });
  const payment = useMutation({
    mutationFn: (approve: boolean) =>
      adminApi<{ order: Order }>(`/orders/${id}/payment`, {
        method: 'PATCH',
        body: { approve, amountPaid: approve && amount ? Number(amount) : undefined, reason: approve ? undefined : reason || undefined },
      }),
    onSuccess: (r, approve) => onDone(r.order, approve ? 'Payment confirmed' : 'Payment rejected'),
    onError,
  });
  const addNote = useMutation({
    mutationFn: () => adminApi<{ order: Order }>(`/orders/${id}/note`, { method: 'PATCH', body: { message: note } }),
    onSuccess: (r) => {
      setNote('');
      onDone(r.order, 'Note added');
    },
    onError,
  });

  if (isLoading) return <PageLoader />;
  if (error || !order) return <ErrorState message="Order not found." />;

  const open = order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && order.status !== 'PICKED_UP';
  const pickup = order.delivery.optionId === 'pickup';
  const next: OrderStatus[] = pickup && order.status === 'PACKING' ? ['PICKED_UP'] : NEXT[order.status];
  const canReviewPayment = open && order.paymentStatus !== 'PAID';
  const address = [order.delivery.city, order.delivery.area, order.delivery.landmark].filter(Boolean).join(', ');
  const phoneIntl = order.customerPhone.replace(/^0/, '+251');

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-steel hover:text-chalk">
        <ArrowLeft className="size-4" /> Orders
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <OrderPaymentBadge order={order} />
        <span className="text-xs text-steel">{formatDateTime(order.createdAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-seam">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  {i.image ? <img src={i.image} alt="" className="aspect-[4/5] w-12 rounded object-cover" /> : <div className="aspect-[4/5] w-12 rounded bg-wool-2" />}
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/products/${i.productId}`} className="block truncate text-sm hover:text-camel">
                      {i.name}
                    </Link>
                    <p className="font-mono text-xs text-steel">{[i.size, i.color].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <span className="font-mono text-sm text-steel">× {i.quantity}</span>
                  <span className="w-24 text-right font-mono text-sm">{birr(i.unitPrice * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-seam pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-steel">Subtotal</dt>
                <dd className="font-mono">{birr(order.subtotal)}</dd>
              </div>
              {order.discounts?.map((d, i) => (
                <div key={i} className="flex justify-between text-ok">
                  <dt>
                    {d.label}
                    {d.code && <span className="ml-1.5 font-mono text-xs opacity-80">{d.code}</span>}
                  </dt>
                  <dd className="font-mono">−{birr(d.amount)}</dd>
                </div>
              ))}
              {order.giftNote && (
                <div className="flex justify-between rounded-lg bg-camel/10 px-2 py-1.5 text-camel">
                  <dt>🎁 Add to the parcel</dt>
                  <dd>{order.giftNote}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-steel">Delivery</dt>
                <dd className="font-mono">{order.deliveryFee === null ? 'by phone' : birr(order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt>Total</dt>
                <dd className="font-mono">{birr(order.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-steel">Paid</dt>
                <dd className="font-mono">{birr(order.amountPaid)}</dd>
              </div>
              {order.balance > 0 && (
                <div className="flex justify-between text-camel">
                  <dt>Balance</dt>
                  <dd className="font-mono">{birr(order.balance)}</dd>
                </div>
              )}
              {order.profit !== undefined && (
                <div className="flex justify-between text-xs text-steel">
                  <dt>Profit</dt>
                  <dd className="font-mono">{birr(order.profit)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Payment">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-steel">Method</dt>
                <dd>{order.payment.label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-steel">Due now</dt>
                <dd className="font-mono">
                  {birr(order.amountDue)}
                  {order.isDeposit && ' (deposit)'}
                </dd>
              </div>
              {order.payment.transactionRef && (
                <div className="flex justify-between">
                  <dt className="text-steel">Transaction</dt>
                  <dd className="select-all font-mono">{order.payment.transactionRef}</dd>
                </div>
              )}
            </dl>
            {order.paymentCheck && (
              <p
                className={cn(
                  'mt-4 rounded-lg px-3 py-2.5 text-sm',
                  order.paymentCheck.startsWith('⚠️') ? 'bg-danger/10 text-danger' : order.paymentCheck.includes('Verified') ? 'bg-ok/10 text-ok' : 'bg-camel/10 text-camel',
                )}
              >
                {order.paymentCheck}
              </p>
            )}
            {order.payment.proofUrl && (
              <a href={order.payment.proofUrl} target="_blank" rel="noreferrer" className="mt-4 block">
                <img src={order.payment.proofUrl} alt="Payment screenshot" className="max-h-96 rounded-lg border border-seam object-contain" />
              </a>
            )}
            {canReviewPayment && (
              <div className="mt-5 space-y-3 border-t border-seam pt-5">
                <Input
                  name="amount"
                  label="Amount received (ETB)"
                  inputMode="numeric"
                  placeholder={String(Math.max(order.amountDue, order.amountPaid))}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                />
                <div className="flex gap-2">
                  <Button variant="accent" className="flex-1" loading={payment.isPending && payment.variables} onClick={() => payment.mutate(true)}>
                    Confirm payment
                  </Button>
                  {order.paymentStatus === 'SUBMITTED' && (
                    <Button variant="danger" loading={payment.isPending && !payment.variables} onClick={() => window.confirm('Reject this payment? The customer is asked to send it again.') && payment.mutate(false)}>
                      Reject
                    </Button>
                  )}
                </div>
                {order.paymentStatus === 'SUBMITTED' && (
                  <Input name="reason" placeholder="Reason sent to the customer (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="font-medium">{order.customerName}</p>
            <p className="mt-1 font-mono text-sm text-steel">{order.customerPhone}</p>
            {order.customerPhone && (
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${order.customerPhone}`} className="inline-flex h-9 items-center gap-2 rounded-full border border-seam px-3 text-sm hover:border-steel">
                <Phone className="size-4" /> Call
              </a>
              <a
                href={`https://t.me/${phoneIntl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-seam px-3 text-sm hover:border-steel"
              >
                <Send className="size-4" /> Telegram
              </a>
            </div>
            )}
            <div className="mt-5 border-t border-seam pt-4 text-sm">
              <p className="label mb-2">{order.delivery.label}</p>
              {address && <p>{address}</p>}
              {order.delivery.lat !== null && order.delivery.lng !== null && (
                <a
                  href={`https://maps.google.com/?q=${order.delivery.lat},${order.delivery.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-camel"
                >
                  <MapPin className="size-4" /> Open map pin
                </a>
              )}
              {order.note && <p className="mt-3 rounded-lg bg-ink p-3 text-steel">“{order.note}”</p>}
            </div>
          </Card>

          <DriverCard order={order} onChange={(o) => onDone(o, 'Saved')} />

          {order.refund && <RefundCard order={order} onDone={(o) => onDone(o, 'Marked refunded')} />}

          {open && order.cancelAt && (
            <CancelCountdown order={order as Order & { cancelAt: string }} onChange={(o) => qc.setQueryData(['admin', 'order', id], o)} />
          )}

          {open && !order.cancelAt && (
            <Card title="Update status">
              <div className="flex flex-wrap gap-2">
                {next.map((s) => (
                  <Button
                    key={s}
                    variant="primary"
                    size="sm"
                    loading={status.isPending && status.variables === s}
                    onClick={() =>
                      s === 'DELIVERED'
                        ? setConfirmDelivered(true) // needs the customer's code (or a written override)
                        : s === 'PICKED_UP'
                          ? window.confirm(`Has the customer picked up ${order.orderNumber}?`) && status.mutate(s)
                          : status.mutate(s)
                    }
                  >
                    {statusLabel(s)}
                  </Button>
                ))}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => window.confirm('Cancel this order? You’ll have 3 minutes to undo it — the customer and driver are only told after that.') && status.mutate('CANCELLED')}
                >
                  Cancel order
                </Button>
              </div>
              <p className="mt-3 text-xs text-steel">The customer gets a Telegram message for each change.</p>
            </Card>
          )}

          <Card title="History">
            <ol className="space-y-3">
              {order.events?.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.type.startsWith('internal') ? 'bg-steel' : 'bg-camel')} />
                  <div>
                    <p>{e.message}</p>
                    <p className="text-xs text-steel">{formatDateTime(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 space-y-2 border-t border-seam pt-4">
              <Textarea name="note" placeholder="Internal note (only staff see this)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button variant="outline" size="sm" disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>
                Add note
              </Button>
            </div>
          </Card>
        </div>
      </div>
      <ConfirmDelivered order={order} open={confirmDelivered} onClose={() => setConfirmDelivered(false)} onDone={(o) => onDone(o, 'Saved')} />
    </div>
  );
}

/** Cancelled after money came in: the refund is a task until someone records how it was given back. */
function RefundCard({ order, onDone }: { order: Order; onDone: (o: Order) => void }) {
  const r = order.refund!;
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => adminApi<{ order: Order }>(`/orders/${order.id}/refunded`, { body: { note: note.trim() } }),
    onSuccess: (x) => onDone(x.order),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });
  if (!r.due)
    return (
      <Card title="Refund">
        <p className="text-sm text-ok">
          ✓ Refunded {birr(r.amount)}
          {r.refundedAt && ` on ${formatDateTime(r.refundedAt)}`}
        </p>
        {r.note && <p className="mt-1 text-sm text-steel">{r.note}</p>}
      </Card>
    );
  return (
    <div className="rounded-2xl border border-danger/40 bg-danger/[0.06] p-4">
      <p className="font-medium">💸 Refund due · {birr(r.amount)}</p>
      <p className="mt-1 text-sm text-steel">
        {r.confirmed ? 'The customer paid, then the order was cancelled.' : 'The customer sent payment proof before the cancel — check the transfer, and give it back if it arrived.'}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How? e.g. telebirr ref 8XY12… / cash at the shop"
          className="h-11 flex-1 rounded-xl border border-seam bg-wool px-3 text-sm focus:border-camel focus:outline-none"
        />
        <Button variant="accent" loading={save.isPending} disabled={note.trim().length < 2} onClick={() => save.mutate()}>
          Mark refunded
        </Button>
      </div>
    </div>
  );
}
