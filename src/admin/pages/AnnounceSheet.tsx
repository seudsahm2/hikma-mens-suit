/**
 * Send one product to customers the owner picks ("✨ Picked for you" on Telegram, with an optional
 * personal line). Opened from Customers (with a selection) or from a product (pick from top customers).
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { Button, Sheet, Textarea } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, cn } from '../../lib/format';
import type { User } from '../../lib/types';
import type { AdminProduct } from '../types';
import { adminApi } from '../ui';

export type CustomerRow = User & { orders: number; spent: number; lastOrderAt: string | null; ordersAllTime?: number };

/** Telegram chat link: @username when there is one, otherwise the user id (opens in the Telegram app). */
export const tgLink = (c: Pick<User, 'telegramUsername' | 'telegramId'>) =>
  c.telegramUsername ? `https://t.me/${c.telegramUsername}` : c.telegramId ? `tg://user?id=${c.telegramId}` : null;

function Avatar({ c }: { c: Pick<User, 'photoUrl' | 'fullName'> }) {
  return c.photoUrl ? (
    <img src={c.photoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-wool-2 text-sm">{c.fullName.slice(0, 1)}</span>
  );
}

export function AnnounceSheet({ open, onClose, productId, customers }: { open: boolean; onClose: () => void; productId?: string; customers?: CustomerRow[] }) {
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  // Product given (from the product page) — load it; otherwise the owner searches
  const one = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => adminApi<{ product: AdminProduct }>(`/products/${productId}`).then((r) => r.product),
    enabled: open && Boolean(productId),
  });
  useEffect(() => {
    if (one.data) setProduct(one.data);
  }, [one.data]);
  const search = useQuery({
    queryKey: ['admin', 'products', 'announce-pick', q],
    queryFn: () => adminApi<{ products: AdminProduct[] }>('/products', { query: { q, status: 'ACTIVE', limit: 12 } }).then((r) => r.products),
    enabled: open && !productId && !product,
  });

  // Recipients: the selection passed in, or the top customers (all time)
  const top = useQuery({
    queryKey: ['admin', 'customers', 'insights', 'all'],
    queryFn: () => adminApi<{ topBySpend: CustomerRow[]; topByOrders: CustomerRow[] }>('/customers/insights', { query: { period: 'all' } }),
    enabled: open && !customers,
  });
  const people: CustomerRow[] = customers ?? [...new Map([...(top.data?.topBySpend ?? []), ...(top.data?.topByOrders ?? [])].map((c) => [c.id, c])).values()];
  // Start with everyone passed in ticked — only when the sheet opens (not on every parent render)
  useEffect(() => {
    if (open) setPicked(new Set((customers ?? []).map((c) => c.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) {
      setNote('');
      setQ('');
      if (!productId) setProduct(null);
    }
  }, [open, productId]);

  const reachable = people.filter((c) => c.telegramId);
  const send = useMutation({
    mutationFn: () => adminApi<{ broadcast: { total: number } }>('/customers/announce', { body: { productId: product!.id, userIds: [...picked], note: note.trim() || undefined } }),
    onSuccess: (r) => {
      toast.ok(`Sending to ${r.broadcast.total} customer${r.broadcast.total === 1 ? '' : 's'} on Telegram`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));

  return (
    <Sheet open={open} onClose={onClose} title="Send a product to customers">
      {/* 1. Product */}
      <p className="label mb-2">Product</p>
      {product ? (
        <div className="flex items-center gap-3 rounded-2xl border border-seam p-3">
          {product.images[0] && <img src={product.images[0].urls.sm} alt="" className="aspect-[4/5] w-12 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{product.nameEn}</p>
            <p className="font-mono text-xs text-steel">{birr(product.basePrice)}</p>
          </div>
          {!productId && (
            <button type="button" onClick={() => setProduct(null)} className="text-xs text-camel">
              Change
            </button>
          )}
        </div>
      ) : (
        <div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a product on sale…" className="h-11 w-full rounded-xl border border-seam bg-wool pl-9 pr-3 text-sm focus:border-camel focus:outline-none" />
          </label>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {(search.data ?? []).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setProduct(p)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-wool-2">
                  {p.images[0] ? <img src={p.images[0].urls.sm} alt="" className="aspect-[4/5] w-9 rounded-md object-cover" /> : <span className="aspect-[4/5] w-9 rounded-md bg-wool-2" />}
                  <span className="min-w-0 flex-1 truncate text-sm">{p.nameEn}</span>
                  <span className="font-mono text-xs text-steel">{birr(p.basePrice)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Who */}
      <div className="mb-2 mt-6 flex items-center justify-between">
        <p className="label">
          Customers · {picked.size} of {reachable.length}
        </p>
        <button type="button" onClick={() => setPicked(picked.size === reachable.length ? new Set() : new Set(reachable.map((c) => c.id)))} className="text-xs text-camel">
          {picked.size === reachable.length ? 'Select none' : 'Select all'}
        </button>
      </div>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {people.map((c) => {
          const can = Boolean(c.telegramId);
          const on = picked.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!can}
                onClick={() => toggle(c.id)}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors', on ? 'border-camel bg-camel/[0.06]' : 'border-transparent hover:bg-wool-2', !can && 'opacity-40')}
              >
                <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border', on ? 'border-camel bg-camel text-ink' : 'border-seam')}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                <Avatar c={c} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{c.fullName}</span>
                  <span className="block truncate text-xs text-steel">{can ? `${c.ordersAllTime ?? c.orders} order${(c.ordersAllTime ?? c.orders) === 1 ? '' : 's'} · ${birr(c.spent)}` : 'No Telegram — can’t message'}</span>
                </span>
              </button>
            </li>
          );
        })}
        {!people.length && <li className="py-4 text-center text-sm text-steel">No customers with orders yet.</li>}
      </ul>

      {/* 3. Personal line */}
      <div className="mt-6">
        <Textarea name="note" label="Personal line (optional)" rows={2} placeholder="e.g. Saved your size for you — only 3 left" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} />
      </div>

      <Button variant="accent" size="lg" block className="mt-5" loading={send.isPending} disabled={!product || !picked.size} onClick={() => send.mutate()}>
        ✨ Send to {picked.size} customer{picked.size === 1 ? '' : 's'}
      </Button>
      <p className="mt-2 text-center text-xs text-steel">They get the photo, price and a “View” button on Telegram.</p>
    </Sheet>
  );
}
