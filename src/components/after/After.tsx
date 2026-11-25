/** After the purchase: save ♡, exchange request. (Receipt: ./Receipt.tsx) */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, RefreshCw } from 'lucide-react';
import { Button, Sheet } from '../ui';
import { toast } from '../ui/toast';
import { api, ApiError } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { cn, formatDate } from '../../lib/format';
import { haptic } from '../../lib/telegram';
import type { Order } from '../../lib/types';
import { useWishlist } from '../../store/wishlist';

// ─── Save ♡ ──────────────────────────────────────────────

export function HeartButton({ productId, className, label }: { productId: string; className?: string; label?: boolean }) {
  const { t } = useT();
  const saved = useWishlist((s) => s.ids.includes(productId));
  const toggle = useWishlist((s) => s.toggle);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        haptic.select();
        void toggle(productId);
      }}
      aria-pressed={saved}
      aria-label={saved ? t('saved.remove') : t('saved.add')}
      className={cn('inline-flex items-center justify-center gap-1.5 transition-transform active:scale-90', className)}
    >
      <Heart className={cn('size-[1.15rem] transition-colors', saved ? 'fill-camel text-camel' : '')} strokeWidth={1.7} />
      {label && <span className="text-sm">{saved ? t('saved.remove') : t('saved.add')}</span>}
    </button>
  );
}

// ─── Exchange ────────────────────────────────────────────

interface ExchangeInfo {
  canRequest: boolean;
  until: string | null;
  days: number;
  requests: { id: string; status: 'requested' | 'approved' | 'declined' | 'done'; staffNote: string | null; items: { name: string; size: string; wantSize: string | null }[] }[];
  items: { orderItemId: string; name: string; size: string; color: string; sizes: string[]; inStock: Record<string, boolean> }[];
}

export function ExchangeBlock({ order }: { order: Order }) {
  const { t, lang } = useT();
  const qc = useQueryClient();
  const received = order.status === 'DELIVERED' || order.status === 'PICKED_UP';
  const q = useQuery({
    queryKey: ['exchange', order.orderNumber],
    queryFn: () => api<ExchangeInfo>(`/exchanges/order/${order.orderNumber}`),
    enabled: received,
  });
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  const [reason, setReason] = useState<'too_small' | 'too_big' | 'defect' | 'other'>('too_small');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const info = q.data;
  if (!received || !info) return null;
  const last = info.requests[0];

  const send = async () => {
    setBusy(true);
    try {
      await api('/exchanges', {
        body: {
          orderNumber: order.orderNumber,
          items: Object.entries(picked).map(([orderItemId, wantSize]) => ({ orderItemId, wantSize })),
          reason,
          note: note.trim() || undefined,
        },
      });
      haptic.success();
      toast.ok(t('ex.sent'));
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['exchange', order.orderNumber] });
      void qc.invalidateQueries({ queryKey: ['order', order.orderNumber] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('common.loadError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      {last && (
        <div
          className={cn(
            'mb-3 rounded-2xl border px-4 py-3 text-sm',
            last.status === 'declined' ? 'border-seam text-steel' : last.status === 'requested' ? 'border-camel/40 text-camel' : 'border-ok/40 text-ok',
          )}
        >
          <p className="flex items-center gap-2 font-medium">
            <RefreshCw className="size-4" /> {t(`ex.${last.status}`)}
          </p>
          <p className="mt-1 text-xs text-steel">
            {last.items.map((i) => `${i.name}${i.size ? ` ${i.size}` : ''}${i.wantSize ? ` → ${i.wantSize}` : ''}`).join(', ')}
          </p>
          {last.staffNote && <p className="mt-1 text-xs text-chalk/80">“{last.staffNote}”</p>}
        </div>
      )}
      {info.canRequest && (
        <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-seam px-4 py-3.5 text-left text-sm transition-colors hover:border-steel">
          <RefreshCw className="size-4 text-camel" />
          <span className="flex-1">{t('ex.button')}</span>
          {info.until && <span className="text-xs text-steel">{t('ex.until', { date: formatDate(info.until, lang) })}</span>}
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('ex.title')}
        footer={
          <Button variant="accent" size="lg" block loading={busy} disabled={!Object.keys(picked).length} onClick={send}>
            {t('ex.send')}
          </Button>
        }
      >
        <p className="label mb-2">{t('ex.which')}</p>
        <div className="space-y-3">
          {info.items.map((i) => {
            const on = i.orderItemId in picked;
            return (
              <div key={i.orderItemId} className={cn('rounded-2xl border p-3 transition-colors', on ? 'border-camel' : 'border-seam')}>
                <button
                  className="flex w-full items-center justify-between text-left text-sm"
                  onClick={() =>
                    setPicked((p) => {
                      const next = { ...p };
                      if (on) delete next[i.orderItemId];
                      else next[i.orderItemId] = null;
                      return next;
                    })
                  }
                >
                  <span>
                    {i.name} <span className="font-mono text-xs text-steel">{i.size}</span>
                  </span>
                  <span className={cn('size-5 rounded-full border-2', on ? 'border-camel bg-camel' : 'border-seam')} />
                </button>
                {on && i.sizes.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs text-steel">{t('ex.want')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {i.sizes.map((s) => (
                        <button
                          key={s}
                          onClick={() => setPicked((p) => ({ ...p, [i.orderItemId]: s }))}
                          className={cn(
                            'h-9 min-w-10 rounded-lg border px-2 font-mono text-sm transition-colors',
                            picked[i.orderItemId] === s ? 'border-camel bg-camel text-ink' : 'border-seam text-steel',
                            !i.inStock[s] && 'opacity-50',
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="label mb-2 mt-6">{t('ex.reason')}</p>
        <div className="grid grid-cols-2 gap-2">
          {(['too_small', 'too_big', 'defect', 'other'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn('h-11 rounded-xl border text-sm transition-colors', reason === r ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel')}
            >
              {t(`ex.${r}`)}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          placeholder={t('ex.note')}
          rows={2}
          className="mt-4 w-full rounded-xl border border-seam bg-ink/40 px-4 py-3 text-sm focus:border-camel focus:outline-none"
        />
      </Sheet>
    </div>
  );
}

