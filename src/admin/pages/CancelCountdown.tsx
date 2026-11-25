/**
 * A staff cancel waiting to take effect (undo window). Nothing has happened yet — no messages,
 * no stock moved — so a wrong tap is fixed with one "Undo". Same rule as the Telegram cards.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/format';
import type { Order } from '../../lib/types';
import { adminApi } from '../ui';

function useSecondsLeft(until: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000));
}

export function CancelCountdown({ order, compact, onChange }: { order: Order & { cancelAt: string }; compact?: boolean; onChange?: (o: Order) => void }) {
  const qc = useQueryClient();
  const left = useSecondsLeft(order.cancelAt);
  const act = useMutation({
    mutationFn: (what: 'undo' | 'now') => adminApi<{ order: Order }>(`/orders/${order.id}/cancel/${what}`, { body: {} }),
    onSuccess: (r, what) => {
      onChange?.(r.order);
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'order', order.id] });
      toast.ok(what === 'undo' ? 'Cancel undone — the order continues' : 'Order cancelled');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  // Timer ran out: the server cancels it within a few seconds — show the result
  useEffect(() => {
    if (left > 0) return;
    const t = setTimeout(() => {
      void qc.invalidateQueries({ queryKey: ['admin', 'order', order.id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    }, 16_000);
    return () => clearTimeout(t);
  }, [left, order.id, qc]);

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[0.7rem] text-red-400">Cancelling {left > 0 ? mmss : '…'}</span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            act.mutate('undo');
          }}
          disabled={act.isPending || left === 0}
          className="inline-flex items-center gap-1 text-xs font-medium text-camel hover:underline disabled:opacity-50"
        >
          <Undo2 className="size-3.5" /> Undo
        </button>
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4">
      <div className="flex items-center gap-4">
        <span className={cn('font-mono text-3xl tabular-nums', left > 0 ? 'text-red-400' : 'text-steel')}>{left > 0 ? mmss : '0:00'}</span>
        <div className="min-w-0">
          <p className="font-medium">{left > 0 ? 'Cancelling this order' : 'Cancelling now…'}</p>
          <p className="text-sm text-steel">Nobody has been told yet and no stock has moved. Tapped by mistake? Undo it.</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => act.mutate('undo')}
          disabled={act.isPending || left === 0}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-camel text-sm font-semibold text-ink disabled:opacity-50 sm:flex-none sm:px-6"
        >
          <Undo2 className="size-4" /> Undo cancel
        </button>
        <button
          onClick={() => window.confirm('Cancel it right now? The customer and driver are told immediately.') && act.mutate('now')}
          disabled={act.isPending || left === 0}
          className="h-10 flex-1 rounded-full border border-seam text-sm text-steel hover:text-red-400 disabled:opacity-50 sm:flex-none sm:px-6"
        >
          Cancel now
        </button>
      </div>
    </div>
  );
}
