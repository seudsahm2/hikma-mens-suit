/**
 * Marking an order "Delivered" from the admin is never one tap. Either:
 *   - type the customer's 4-digit delivery code (call them and ask), or
 *   - "without code": write why AND type the last 4 characters of the order number.
 * The override is written in the order history + activity log, and the customer is told.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Phone, ShieldAlert } from 'lucide-react';
import { Button, Sheet } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/format';
import type { Order } from '../../lib/types';
import { adminApi } from '../ui';

export function ConfirmDelivered({ order, open, onClose, onDone }: { order: Order; open: boolean; onClose: () => void; onDone: (o: Order) => void }) {
  const [mode, setMode] = useState<'code' | 'override'>('code');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const last4 = order.orderNumber.slice(-4).toUpperCase();

  const save = useMutation({
    mutationFn: () =>
      adminApi<{ order: Order }>(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: mode === 'code' ? { status: 'DELIVERED', code } : { status: 'DELIVERED', overrideReason: reason, overrideConfirm: confirm },
      }),
    onSuccess: (r) => {
      toast.ok(mode === 'code' ? 'Delivered — code confirmed' : 'Marked delivered (without code)');
      setCode('');
      setReason('');
      setConfirm('');
      onDone(r.order);
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
      setCode('');
    },
  });
  const ready = mode === 'code' ? code.length === 4 : reason.trim().length >= 10 && confirm.trim().toUpperCase() === last4;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Confirm delivery · ${order.orderNumber}`}
      footer={
        <Button variant={mode === 'code' ? 'accent' : 'danger'} size="lg" block disabled={!ready} loading={save.isPending} onClick={() => save.mutate()}>
          {mode === 'code' ? 'Confirm delivered' : 'Mark delivered without code'}
        </Button>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-seam p-1">
        {(
          [
            ['code', 'Customer’s code', KeyRound],
            ['override', 'Without code', ShieldAlert],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn('flex h-10 items-center justify-center gap-2 rounded-full text-sm transition-colors', mode === m ? 'bg-chalk text-ink' : 'text-steel')}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === 'code' ? (
        <div className="space-y-4">
          <p className="text-sm text-steel">The customer has a 4-digit delivery code on Telegram and on their order page. Ask them for it.</p>
          <a href={`tel:${order.customerPhone}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-seam px-4 text-sm hover:border-steel">
            <Phone className="size-4" /> Call {order.customerName.split(' ')[0]} · {order.customerPhone}
          </a>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autoFocus
            placeholder="• • • •"
            aria-label="Delivery code"
            className="h-16 w-full rounded-2xl border border-seam bg-ink/40 text-center font-mono text-3xl tracking-[0.5em] focus:border-camel focus:outline-none"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
            Only if you’re sure the customer has the items. This is recorded with your name, and the customer gets a message asking them to tell you if they didn’t receive it.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] text-steel">Why can’t you use the code?</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="e.g. Customer came to the shop and took it; their phone is off"
              className="w-full rounded-xl border border-seam bg-ink/40 px-4 py-3 text-sm focus:border-camel focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] text-steel">
              To confirm, type the last 4 characters of the order number (<span className="font-mono text-chalk">{order.orderNumber}</span>)
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.toUpperCase().slice(0, 4))}
              placeholder={last4.replace(/./g, '•')}
              className="h-12 w-40 rounded-xl border border-seam bg-ink/40 px-4 font-mono text-lg tracking-widest focus:border-camel focus:outline-none"
            />
          </label>
        </div>
      )}
    </Sheet>
  );
}
