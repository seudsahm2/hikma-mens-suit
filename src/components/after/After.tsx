/** After the purchase: save ♡, exchange request, shareable receipt. */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Heart, Receipt, RefreshCw, Share2 } from 'lucide-react';
import { Button, Sheet } from '../ui';
import { toast } from '../ui/toast';
import { api, ApiError } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { birr, cn, formatDate } from '../../lib/format';
import { haptic, isMiniApp } from '../../lib/telegram';
import type { Order, StoreSettings } from '../../lib/types';
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

// ─── Receipt ─────────────────────────────────────────────

async function drawReceipt(order: Order, store: StoreSettings | undefined, labels: { status: string; total: string; paid: string; subtotal: string; delivery: string }) {
  await document.fonts?.ready;
  const W = 1080;
  const pad = 80;
  const rows = order.items.length + (order.discounts?.length ?? 0);
  const H = 980 + rows * 74;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const ink = '#0D1015';
  const chalk = '#ECE9E3';
  const steel = '#7F8894';
  const camel = '#B98B57';
  const ok = '#7FB38D';
  g.fillStyle = ink;
  g.fillRect(0, 0, W, H);
  // tape-measure edge
  g.fillStyle = camel;
  g.fillRect(0, 0, W, 14);
  g.fillStyle = ink;
  for (let x = 20; x < W; x += 24) g.fillRect(x, 0, 2, x % 120 === 20 ? 12 : 7);

  let y = 150;
  g.fillStyle = chalk;
  g.font = '800 64px Archivo, sans-serif';
  g.fillText('HIKMA', pad, y);
  g.fillStyle = steel;
  g.font = '500 22px "IBM Plex Mono", monospace';
  g.fillText('MEN’S FASHION', pad, y + 40);
  g.textAlign = 'right';
  g.fillStyle = camel;
  g.font = '600 30px "IBM Plex Mono", monospace';
  g.fillText(order.orderNumber, W - pad, y - 8);
  g.fillStyle = steel;
  g.font = '400 24px "Hanken Grotesk", sans-serif';
  g.fillText(new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - pad, y + 34);
  g.textAlign = 'left';

  y += 120;
  const line = () => {
    g.fillStyle = '#262C35';
    g.fillRect(pad, y, W - pad * 2, 2);
  };
  line();
  y += 70;
  g.font = '500 30px "Hanken Grotesk", sans-serif';
  for (const i of order.items) {
    g.fillStyle = chalk;
    const name = i.name.length > 30 ? `${i.name.slice(0, 29)}…` : i.name;
    g.fillText(name, pad, y);
    g.fillStyle = steel;
    g.font = '400 24px "IBM Plex Mono", monospace';
    g.fillText([i.size, i.color, `×${i.quantity}`].filter(Boolean).join(' · '), pad, y + 32);
    g.textAlign = 'right';
    g.fillStyle = chalk;
    g.font = '500 30px "IBM Plex Mono", monospace';
    g.fillText(birr(i.unitPrice * i.quantity), W - pad, y);
    g.textAlign = 'left';
    g.font = '500 30px "Hanken Grotesk", sans-serif';
    y += 74;
  }
  line();
  y += 64;
  const row = (label: string, value: string, color = steel, valueColor = chalk) => {
    g.fillStyle = color;
    g.font = '400 28px "Hanken Grotesk", sans-serif';
    g.fillText(label, pad, y);
    g.textAlign = 'right';
    g.fillStyle = valueColor;
    g.font = '500 28px "IBM Plex Mono", monospace';
    g.fillText(value, W - pad, y);
    g.textAlign = 'left';
    y += 54;
  };
  row(labels.subtotal, birr(order.subtotal));
  for (const d of order.discounts ?? []) row(d.label, `−${birr(d.amount)}`, ok, ok);
  row(labels.delivery, order.deliveryFee === null ? '—' : order.deliveryFee === 0 ? '0 ETB' : birr(order.deliveryFee));
  y += 16;
  g.fillStyle = chalk;
  g.font = '700 40px "Hanken Grotesk", sans-serif';
  g.fillText(labels.total, pad, y + 10);
  g.textAlign = 'right';
  g.font = '700 52px "IBM Plex Mono", monospace';
  g.fillText(birr(order.total), W - pad, y + 14);
  g.textAlign = 'left';
  y += 80;
  // status stamp
  g.strokeStyle = order.paymentStatus === 'PAID' ? ok : camel;
  g.fillStyle = order.paymentStatus === 'PAID' ? ok : camel;
  g.lineWidth = 3;
  g.font = '600 26px "IBM Plex Mono", monospace';
  const stamp = labels.status.toUpperCase();
  const sw = g.measureText(stamp).width + 48;
  g.beginPath();
  g.roundRect(pad, y, sw, 56, 28);
  g.stroke();
  g.fillText(stamp, pad + 24, y + 38);
  if (order.amountPaid > 0 && order.amountPaid < order.total) {
    g.textAlign = 'right';
    g.fillStyle = steel;
    g.font = '400 26px "Hanken Grotesk", sans-serif';
    g.fillText(`${labels.paid}: ${birr(order.amountPaid)}`, W - pad, y + 38);
    g.textAlign = 'left';
  }
  // footer
  y = H - 120;
  g.fillStyle = '#262C35';
  g.fillRect(pad, y - 40, W - pad * 2, 2);
  g.fillStyle = steel;
  g.font = '400 24px "Hanken Grotesk", sans-serif';
  g.fillText(store?.addressEn ?? 'Betel · Addis Ababa', pad, y);
  g.fillText([store?.phone, store?.telegramInbox ? `@${store.telegramInbox}` : null].filter(Boolean).join('  ·  '), pad, y + 40);
  return new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
}

export function ReceiptButton({ order, store, className }: { order: Order; store?: StoreSettings; className?: string }) {
  const { t } = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  const make = async () => {
    const b = await drawReceipt(order, store, {
      status: order.paymentStatus === 'PAID' ? `✓ ${t('pay.PAID')}` : t(`pay.${order.paymentStatus}`),
      total: t('checkout.total'),
      paid: t('order.paid'),
      subtotal: t('bag.subtotal'),
      delivery: t('checkout.delivery'),
    });
    setBlob(b);
    setUrl(URL.createObjectURL(b));
  };
  const file = () => new File([blob!], `Hikma-${order.orderNumber}.png`, { type: 'image/png' });
  const canShare = Boolean(blob && navigator.canShare?.({ files: [file()] }));

  return (
    <>
      <button onClick={make} className={cn('inline-flex items-center gap-2 rounded-full border border-seam px-4 py-2 text-sm transition-colors hover:border-steel', className)}>
        <Receipt className="size-4 text-camel" /> {t('rc.button')}
      </button>
      <Sheet
        open={Boolean(url)}
        onClose={() => setUrl(null)}
        title={t('rc.title')}
        footer={
          <div className="flex gap-2">
            {canShare && (
              <Button variant="accent" block onClick={() => navigator.share({ files: [file()], title: order.orderNumber }).catch(() => undefined)}>
                <Share2 className="size-4" /> {t('rc.share')}
              </Button>
            )}
            {!isMiniApp && (
              <a href={url ?? '#'} download={`Hikma-${order.orderNumber}.png`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-seam px-5 text-sm font-semibold">
                <Download className="size-4" /> {t('rc.save')}
              </a>
            )}
          </div>
        }
      >
        {url && <img src={url} alt={order.orderNumber} className="w-full rounded-xl border border-seam" />}
        {isMiniApp && !canShare && <p className="mt-3 text-center text-xs text-steel">{t('rc.hint')}</p>}
      </Sheet>
    </>
  );
}
