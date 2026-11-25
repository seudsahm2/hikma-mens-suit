/**
 * Shareable receipt: drawn on the phone as a paper receipt image.
 * - Website: Download / Share.
 * - Inside Telegram (downloads don't work there): "Send to my Telegram" — the bot sends the image to
 *   the customer's own chat, where saving and forwarding always work.
 * Drawing avoids newer canvas features (no roundRect) so it works in older phone web views too.
 */
import { useEffect, useState } from 'react';
import { Download, Loader2, Receipt as ReceiptIcon, Send, Share2 } from 'lucide-react';
import { Button, Sheet } from '../ui';
import { toast } from '../ui/toast';
import { api, ApiError } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/format';
import { haptic, isMiniApp } from '../../lib/telegram';
import type { Order, StoreSettings } from '../../lib/types';
import { useCustomer } from '../../store/auth';

// The shop's mark (shirt + trousers) — same geometry as components/brand/Mark.tsx
const SHIRT = ['M24 28 L35 24 L40 30 L45 24 L56 28 L65 47 L58 50 L53 40 L53 76 L27 76 L27 40 L22 50 L15 47 Z', 'M35 24 L37 34 L40 30 L43 34 L45 24', 'M40 30 V76'];
const TROUSERS = ['M53 31 L75 31 L77 84 L68 84 L64 50 L60 84 L51 84 Z', 'M53.3 37 L75.2 37', 'M64 37 V46', 'M56 37 Q58.5 41 57.5 44.5', 'M72.5 37 Q70 41 71 44.5'];

const PAPER = '#FBFAF6';
const INK = '#14171C';
const MUTED = '#6E6A62';
const RULE = '#D9D3C7';
const CAMEL = '#9A6A36';
const OK = '#2E7A48';

const etb = (n: number) => `${n.toLocaleString('en-US')} ETB`;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawMark(g: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size / 100;
  g.save();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(s, s);
  g.fillStyle = INK;
  g.beginPath();
  g.arc(50, 50, 49, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = PAPER;
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // shirt (behind)
  g.save();
  g.translate(3, -3);
  g.translate(40, 52);
  g.rotate((-16 * Math.PI) / 180);
  g.translate(-40, -52);
  SHIRT.forEach((d) => g.stroke(new Path2D(d)));
  g.fillStyle = PAPER;
  [41, 50, 59, 68].forEach((y) => {
    g.beginPath();
    g.arc(42.6, y, 1.35, 0, Math.PI * 2);
    g.fill();
  });
  g.restore();
  // trousers (in front: filled with ink to hide the shirt lines behind)
  g.save();
  g.translate(3, -1);
  g.translate(64, 56);
  g.rotate((12 * Math.PI) / 180);
  g.translate(-64, -56);
  g.fillStyle = INK;
  const outline = new Path2D(TROUSERS[0]);
  g.lineWidth = 7;
  g.strokeStyle = INK;
  g.stroke(outline);
  g.fill(outline);
  g.lineWidth = 2.4;
  g.strokeStyle = PAPER;
  TROUSERS.forEach((d) => g.stroke(new Path2D(d)));
  g.restore();
  g.restore();
}

function ellipsize(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all(['700 40px Archivo', '500 28px "IBM Plex Mono"', '400 28px "Hanken Grotesk"', '600 28px "Hanken Grotesk"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* system fonts are fine */
  }
}

interface Labels {
  receipt: string;
  subtotal: string;
  delivery: string;
  total: string;
  paid: string;
  balance: string;
  status: string;
  thanks: string;
  payment: string;
}

export async function drawReceipt(order: Order, store: StoreSettings | undefined, L: Labels): Promise<Blob> {
  await fontsReady();
  const W = 1080;
  const P = 84; // side padding
  const discounts = order.discounts ?? [];
  const balance = Math.max(0, order.total - order.amountPaid);
  const H = 1240 + order.items.length * 92 + discounts.length * 50 + (order.amountPaid > 0 ? 50 : 0) + (balance > 0 && order.amountPaid > 0 ? 50 : 0);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');

  // Paper with a torn (zig-zag) bottom edge; transparent around it
  const tooth = 18;
  g.fillStyle = PAPER;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, H - tooth);
  for (let x = W; x > 0; x -= tooth * 2) {
    g.lineTo(x - tooth, H);
    g.lineTo(x - tooth * 2, H - tooth);
  }
  g.closePath();
  g.fill();
  // tape-measure top edge
  g.fillStyle = CAMEL;
  g.fillRect(0, 0, W, 12);
  g.fillStyle = PAPER;
  for (let x = 24; x < W; x += 24) g.fillRect(x, 0, 2, x % 120 === 0 ? 10 : 6);

  const center = (text: string, y: number, font: string, color: string) => {
    g.font = font;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.fillText(text, W / 2, y);
    g.textAlign = 'left';
  };
  const dashed = (y: number) => {
    g.strokeStyle = RULE;
    g.lineWidth = 2;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(P, y);
    g.lineTo(W - P, y);
    g.stroke();
    g.setLineDash([]);
  };
  const row = (left: string, right: string, y: number, opts: { color?: string; font?: string; rightFont?: string } = {}) => {
    g.font = opts.font ?? '400 28px "Hanken Grotesk", sans-serif';
    g.fillStyle = opts.color ?? MUTED;
    g.textAlign = 'left';
    g.fillText(ellipsize(g, left, 560), P, y);
    g.font = opts.rightFont ?? '500 28px "IBM Plex Mono", monospace';
    g.fillStyle = opts.color ?? INK;
    g.textAlign = 'right';
    g.fillText(right, W - P, y);
    g.textAlign = 'left';
  };

  // Header
  drawMark(g, W / 2, 128, 120);
  center('HIKMA', 252, '800 56px Archivo, sans-serif', INK);
  center('MEN’S FASHION', 292, '500 22px "IBM Plex Mono", monospace', MUTED);
  center(store?.addressEn ?? 'Betel · Addis Ababa', 340, '400 24px "Hanken Grotesk", sans-serif', MUTED);
  center([store?.phone, store?.telegramInbox ? `@${store.telegramInbox}` : null].filter(Boolean).join('   ·   '), 374, '400 24px "Hanken Grotesk", sans-serif', MUTED);

  let y = 420;
  dashed(y);
  y += 64;
  g.font = '500 22px "IBM Plex Mono", monospace';
  g.fillStyle = MUTED;
  g.fillText(L.receipt.toUpperCase(), P, y);
  g.textAlign = 'right';
  g.fillText(new Date(order.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), W - P, y);
  g.textAlign = 'left';
  y += 56;
  g.font = '600 44px "IBM Plex Mono", monospace';
  g.fillStyle = INK;
  g.fillText(order.orderNumber, P, y);
  y += 46;
  g.font = '400 26px "Hanken Grotesk", sans-serif';
  g.fillStyle = MUTED;
  g.fillText(`${order.customerName}  ·  ${L.payment}: ${order.payment.label ?? '—'}`, P, y);
  y += 40;
  dashed(y);

  // Items
  y += 62;
  for (const i of order.items) {
    g.font = '600 30px "Hanken Grotesk", sans-serif';
    g.fillStyle = INK;
    g.fillText(ellipsize(g, i.name, 620), P, y);
    g.font = '500 30px "IBM Plex Mono", monospace';
    g.textAlign = 'right';
    g.fillText(etb(i.unitPrice * i.quantity), W - P, y);
    g.textAlign = 'left';
    g.font = '400 24px "IBM Plex Mono", monospace';
    g.fillStyle = MUTED;
    g.fillText([i.size, i.color, `${i.quantity} × ${etb(i.unitPrice)}`].filter(Boolean).join('  ·  '), P, y + 36);
    y += 92;
  }
  dashed(y - 20);

  // Totals
  y += 40;
  row(L.subtotal, etb(order.subtotal), y);
  for (const d of discounts) {
    y += 50;
    row(d.code ? `${d.label} (${d.code})` : d.label, `−${etb(d.amount)}`, y, { color: OK });
  }
  y += 50;
  row(L.delivery, order.deliveryFee === null ? '—' : order.deliveryFee === 0 ? '0 ETB' : etb(order.deliveryFee), y);
  y += 34;
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(P, y);
  g.lineTo(W - P, y);
  g.stroke();
  y += 70;
  row(L.total.toUpperCase(), etb(order.total), y, { color: INK, font: '800 40px Archivo, sans-serif', rightFont: '700 48px "IBM Plex Mono", monospace' });
  if (order.amountPaid > 0) {
    y += 54;
    row(L.paid, etb(order.amountPaid), y);
  }
  if (balance > 0 && order.amountPaid > 0) {
    y += 50;
    row(L.balance, etb(balance), y, { color: CAMEL });
  }

  // Stamp
  y += 110;
  const paid = order.paymentStatus === 'PAID';
  const stamp = L.status.toUpperCase();
  g.save();
  g.translate(W / 2, y);
  g.rotate((-6 * Math.PI) / 180);
  g.font = '700 40px "IBM Plex Mono", monospace';
  const sw = g.measureText(stamp).width + 80;
  g.strokeStyle = paid ? OK : CAMEL;
  g.fillStyle = paid ? OK : CAMEL;
  g.lineWidth = 5;
  roundRect(g, -sw / 2, -46, sw, 92, 18);
  g.stroke();
  g.textAlign = 'center';
  g.fillText(stamp, 0, 14);
  g.restore();

  // Footer
  center(L.thanks, H - 92, '600 28px "Hanken Grotesk", sans-serif', INK);

  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

export function ReceiptButton({ order, store, className }: { order: Order; store?: StoreSettings; className?: string }) {
  const { t } = useT();
  const user = useCustomer((s) => s.user);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'drawing' | 'ready' | 'error'>('idle');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  const make = async () => {
    setOpen(true);
    setState('drawing');
    try {
      const b = await drawReceipt(order, store, {
        receipt: t('rc.title'),
        subtotal: t('bag.subtotal'),
        delivery: t('checkout.delivery'),
        total: t('checkout.total'),
        paid: t('order.paid'),
        balance: t('order.balance'),
        payment: t('order.payment'),
        status: order.paymentStatus === 'PAID' ? `✓ ${t('pay.PAID')}` : t(`pay.${order.paymentStatus}`),
        thanks: t('rc.thanks'),
      });
      setBlob(b);
      setUrl(URL.createObjectURL(b));
      setState('ready');
    } catch {
      setState('error');
    }
  };

  const fileName = `Hikma-${order.orderNumber}.png`;
  const file = () => new File([blob!], fileName, { type: 'image/png' });
  const canShare = (() => {
    try {
      return Boolean(blob && navigator.canShare?.({ files: [file()] }));
    } catch {
      return false;
    }
  })();
  const canTelegram = Boolean(user?.telegramId);

  const sendToTelegram = async () => {
    if (!blob) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append('image', blob, fileName);
      await api(`/orders/${order.orderNumber}/receipt`, { form });
      haptic.success();
      toast.ok(t('rc.sent'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('common.loadError'));
    } finally {
      setSending(false);
    }
  };
  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <>
      <button onClick={make} className={cn('inline-flex items-center gap-2 rounded-full border border-seam px-4 py-2 text-sm transition-colors hover:border-steel', className)}>
        <ReceiptIcon className="size-4 text-camel" /> {t('rc.button')}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('rc.title')}
        footer={
          state === 'ready' ? (
            <div className="flex flex-col gap-2">
              {/* Inside Telegram: sending to the chat is the reliable way to keep it */}
              {(isMiniApp || canTelegram) && (
                <Button variant={isMiniApp ? 'accent' : 'outline'} block loading={sending} disabled={!canTelegram} onClick={sendToTelegram}>
                  <Send className="size-4" /> {t('rc.toTelegram')}
                </Button>
              )}
              <div className="flex gap-2">
                {!isMiniApp && (
                  <Button variant={canTelegram ? 'outline' : 'accent'} block onClick={download}>
                    <Download className="size-4" /> {t('rc.save')}
                  </Button>
                )}
                {canShare && (
                  <Button variant="outline" block onClick={() => navigator.share({ files: [file()], title: order.orderNumber }).catch(() => undefined)}>
                    <Share2 className="size-4" /> {t('rc.share')}
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {state === 'drawing' && (
          <div className="grid place-items-center py-20 text-steel">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        {state === 'error' && (
          <div className="py-16 text-center">
            <p className="text-sm text-steel">{t('rc.error')}</p>
            <Button variant="outline" className="mt-4" onClick={make}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        {state === 'ready' && url && (
          <div className="rounded-2xl bg-wool-2 p-3">
            <img src={url} alt={order.orderNumber} className="mx-auto w-full max-w-sm rounded-sm shadow-xl" />
          </div>
        )}
      </Sheet>
    </>
  );
}
