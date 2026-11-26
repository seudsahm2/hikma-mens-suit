import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Minus, Plus, Search, ShoppingBag, Undo2, X } from 'lucide-react';
import { Button, Input, Sheet } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, cn, num, sortSizes } from '../../lib/format';
import type { Order } from '../../lib/types';
import type { AdminProduct, AdminVariant } from '../types';
import { adminApi, Card } from '../ui';

interface Line {
  variantId: string;
  name: string;
  detail: string;
  image: string | null;
  listPrice: number;
  price: number;
  quantity: number;
  max: number;
}
interface Today {
  sales: Order[];
  total: number;
  pieces: number;
  undoHours: number;
  paymentMethods: { id: string; name: string }[];
}

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong');
const variantPrice = (p: AdminProduct, v: AdminVariant) => v.price ?? p.basePrice;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ─── Size picker for one product ─────────────────────────

function PickSize({ product, inTicket, onPick, onClose }: { product: AdminProduct; inTicket: (id: string) => number; onPick: (v: AdminVariant) => void; onClose: () => void }) {
  const variants = product.variants.filter((v) => v.isActive);
  const colors = [...new Set(variants.map((v) => v.color))];
  return (
    <Sheet open onClose={onClose} title={product.nameEn}>
      <div className="flex items-center gap-4">
        {product.images[0] && <img src={product.images[0].urls.sm} alt="" className="aspect-[4/5] w-20 rounded-xl object-cover" />}
        <p className="font-mono text-lg">{birr(product.basePrice)}</p>
      </div>
      {colors.map((color) => {
        const row = variants.filter((v) => v.color === color);
        const sorted = sortSizes(row.map((v) => v.size)).map((s) => row.find((v) => v.size === s)!);
        return (
          <div key={color || 'one'} className="mt-6">
            {color && <p className="label mb-2">{color}</p>}
            <div className="grid grid-cols-4 gap-2">
              {sorted.map((v) => {
                const taken = inTicket(v.id);
                const left = v.stock - taken;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={left <= 0}
                    onClick={() => onPick(v)}
                    className={cn(
                      'relative flex h-16 flex-col items-center justify-center rounded-xl border bg-ink/40 transition-colors',
                      taken > 0 ? 'border-camel' : 'border-seam hover:border-camel',
                      v.stock <= 0 && 'opacity-30',
                    )}
                  >
                    {taken > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-camel font-mono text-[0.65rem] font-bold text-ink">{taken}</span>
                    )}
                    <span className="font-mono text-base">{v.size || 'Add'}</span>
                    <span className={cn('text-[0.7rem]', left <= 1 ? 'text-camel' : 'text-steel')}>{v.stock <= 0 ? 'none' : left > 0 ? `${left} left` : 'all in sale'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {!variants.length && <p className="mt-6 text-sm text-steel">No sizes or stock yet — add them on the product page.</p>}
    </Sheet>
  );
}

// ─── Ticket ──────────────────────────────────────────────

function Ticket({
  lines,
  setLines,
  methods,
  onDone,
}: {
  lines: Line[];
  setLines: (fn: (l: Line[]) => Line[]) => void;
  methods: Today['paymentMethods'];
  onDone: (o: Order) => void;
}) {
  const [method, setMethod] = useState('cash');
  const [more, setMore] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [editing, setEditing] = useState<string | null>(null);
  const total = lines.reduce((n, l) => n + l.price * l.quantity, 0);
  const list = lines.reduce((n, l) => n + l.listPrice * l.quantity, 0);

  const sell = useMutation({
    mutationFn: () =>
      adminApi<{ order: Order }>('/counter', {
        body: {
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, ...(l.price !== l.listPrice ? { unitPrice: l.price } : {}) })),
          paymentMethodId: method,
          customerName: customer.name || undefined,
          customerPhone: customer.phone || undefined,
        },
      }),
    onSuccess: (r) => {
      setCustomer({ name: '', phone: '' });
      setMore(false);
      setMethod('cash');
      onDone(r.order);
    },
    onError: (err) => toast.error(errMsg(err)),
  });

  if (!lines.length) {
    return (
      <div className="grid place-items-center gap-2 py-10 text-center text-sm text-steel">
        <ShoppingBag className="size-7 text-seam" />
        Tap a product to start a sale
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-seam/60">
        {lines.map((l) => (
          <li key={l.variantId} className="flex items-center gap-3 py-3 first:pt-0">
            {l.image ? <img src={l.image} alt="" className="aspect-[4/5] w-11 rounded-md object-cover" /> : <div className="aspect-[4/5] w-11 rounded-md bg-wool-2" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{l.name}</p>
              <p className="font-mono text-xs text-steel">{l.detail || '—'}</p>
              {editing === l.variantId ? (
                <input
                  autoFocus
                  inputMode="numeric"
                  defaultValue={l.price}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, ''));
                    setLines((all) => all.map((x) => (x.variantId === l.variantId ? { ...x, price: v > 0 ? v : x.listPrice } : x)));
                    setEditing(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="mt-1 h-8 w-28 rounded-md border border-camel bg-ink px-2 font-mono text-sm focus:outline-none"
                  aria-label="Price"
                />
              ) : (
                <button type="button" onClick={() => setEditing(l.variantId)} className="mt-0.5 font-mono text-sm hover:text-camel" title="Change price">
                  {num(l.price)}
                  {l.price !== l.listPrice && <span className="ml-1.5 text-xs text-steel line-through">{num(l.listPrice)}</span>}
                </button>
              )}
            </div>
            <div className="flex items-center rounded-full border border-seam">
              <button
                type="button"
                onClick={() =>
                  setLines((all) =>
                    l.quantity <= 1 ? all.filter((x) => x.variantId !== l.variantId) : all.map((x) => (x.variantId === l.variantId ? { ...x, quantity: x.quantity - 1 } : x)),
                  )
                }
                className="grid size-9 place-items-center text-steel hover:text-chalk"
                aria-label="One less"
              >
                {l.quantity <= 1 ? <X className="size-4" /> : <Minus className="size-4" />}
              </button>
              <span className="w-6 text-center font-mono text-sm">{l.quantity}</span>
              <button
                type="button"
                disabled={l.quantity >= l.max}
                onClick={() => setLines((all) => all.map((x) => (x.variantId === l.variantId ? { ...x, quantity: x.quantity + 1 } : x)))}
                className="grid size-9 place-items-center text-camel hover:text-chalk disabled:opacity-30"
                aria-label="One more"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div>
        <p className="label mb-2">Paid with</p>
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                'h-10 rounded-full border px-4 text-sm transition-colors',
                method === m.id ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel hover:text-chalk',
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {more ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="cname" label="Customer name" value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />
          <Input name="cphone" label="Phone" inputMode="tel" value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
        </div>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="text-sm text-steel hover:text-chalk">
          + Customer name / phone (optional)
        </button>
      )}

      <div className="flex items-end justify-between border-t border-seam pt-4">
        <span className="text-sm text-steel">Total</span>
        <span className="text-right">
          {total !== list && <span className="mr-2 font-mono text-sm text-steel line-through">{num(list)}</span>}
          <span className="font-mono text-2xl">{birr(total)}</span>
        </span>
      </div>
      <Button variant="accent" size="lg" block loading={sell.isPending} onClick={() => sell.mutate()}>
        <Check className="size-5" /> Complete sale
      </Button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

export default function Counter() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [picking, setPicking] = useState<AdminProduct | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [done, setDone] = useState<Order | null>(null);

  const today = useQuery({ queryKey: ['admin', 'counter'], queryFn: () => adminApi<Today>('/counter/today') });
  const products = useQuery({
    queryKey: ['admin', 'counter-products', query],
    queryFn: () => adminApi<{ products: AdminProduct[] }>('/products', { query: { q: query || undefined, limit: 40 } }).then((r) => r.products),
  });
  const inTicket = useMemo(() => {
    const m = new Map(lines.map((l) => [l.variantId, l.quantity]));
    return (id: string) => m.get(id) ?? 0;
  }, [lines]);

  const add = (p: AdminProduct, v: AdminVariant) => {
    setLines((all) => {
      const existing = all.find((l) => l.variantId === v.id);
      if (existing) return all.map((l) => (l.variantId === v.id ? { ...l, quantity: Math.min(l.quantity + 1, v.stock) } : l));
      const price = variantPrice(p, v);
      return [
        ...all,
        { variantId: v.id, name: p.nameEn, detail: [v.size, v.color].filter(Boolean).join(' · '), image: p.images[0]?.urls.sm ?? null, listPrice: price, price, quantity: 1, max: v.stock },
      ];
    });
    setPicking(null);
    toast.ok(`Added ${[p.nameEn, v.size].filter(Boolean).join(' · ')}`);
  };
  const tapProduct = (p: AdminProduct) => {
    const active = p.variants.filter((v) => v.isActive);
    // One size only (perfume, watch…): add straight away
    if (active.length === 1 && active[0]!.stock - inTicket(active[0]!.id) > 0) return add(p, active[0]!);
    setPicking(p);
  };
  const finished = (o: Order) => {
    setLines([]);
    setTicketOpen(false);
    setDone(o);
    void qc.invalidateQueries({ queryKey: ['admin', 'counter'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'counter-products'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'products'] });
  };
  const undo = useMutation({
    mutationFn: (id: string) => adminApi<{ order: Order }>(`/counter/${id}/undo`, { body: {} }),
    onSuccess: () => {
      toast.ok('Sale undone — items are back in stock');
      setDone(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'counter'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'counter-products'] });
    },
    onError: (err) => toast.error(errMsg(err)),
  });

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.price * l.quantity, 0);
  const methods = today.data?.paymentMethods ?? [{ id: 'cash', name: 'Cash' }];
  const undoable = (o: Order) => o.status !== 'CANCELLED' && Date.now() - new Date(o.createdAt).getTime() < (today.data?.undoHours ?? 24) * 3600_000;

  return (
    <div className="mx-auto max-w-6xl pb-28 lg:pb-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl">Shop counter</h1>
          <p className="mt-1 text-sm text-steel">Sell to walk-in customers — stock updates for the website instantly.</p>
        </div>
        {today.data && (
          <p className="font-mono text-sm">
            <span className="text-steel">Today · </span>
            {today.data.pieces} pcs · <span className="text-camel">{birr(today.data.total)}</span>
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          {done && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok/40 bg-ok/10 px-4 py-3">
              <p className="text-sm">
                <Check className="mr-1.5 inline size-4 text-ok" />
                Sold · <span className="font-mono">{birr(done.total)}</span> · {done.payment.label}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" loading={undo.isPending} onClick={() => window.confirm('Undo this sale? The items go back in stock.') && undo.mutate(done.id)}>
                  <Undo2 className="size-4" /> Undo
                </Button>
                <button onClick={() => setDone(null)} className="p-1 text-steel" aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          <label className="flex h-14 items-center gap-3 rounded-2xl border border-seam bg-wool px-4 focus-within:border-camel">
            <Search className="size-5 text-steel" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, brand or code"
              className="h-full min-w-0 flex-1 bg-transparent text-base focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ('')} className="text-steel" aria-label="Clear">
                <X className="size-4" />
              </button>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {(products.data ?? []).map((p) => {
              const active = p.variants.filter((v) => v.isActive);
              const onShelf = active.reduce((n, v) => n + v.stock, 0);
              const picked = active.reduce((n, v) => n + inTicket(v.id), 0);
              const left = onShelf - picked;
              // Selected = camel frame + "in this sale" badge (never dimmed). Only truly sold-out items fade.
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tapProduct(p)}
                  disabled={left <= 0}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-wool text-left transition-[border-color,box-shadow]',
                    picked > 0 ? 'border-camel shadow-[0_0_0_1px_var(--color-camel)]' : 'border-seam/80 hover:border-camel',
                    onShelf <= 0 && 'opacity-40',
                    left <= 0 && 'cursor-default',
                  )}
                >
                  {p.images[0] ? (
                    <img src={p.images[0].urls.sm} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-wool-2" />
                  )}
                  {picked > 0 && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-camel px-2.5 py-1 text-[0.7rem] font-semibold text-ink shadow">
                      <Check className="size-3.5" strokeWidth={3} /> {picked} in this sale
                    </span>
                  )}
                  <div className="p-3">
                    <p className="line-clamp-1 text-sm">{p.nameEn}</p>
                    <p className="mt-0.5 flex justify-between font-mono text-xs">
                      <span>{num(p.basePrice)}</span>
                      <span className={left <= 1 ? 'text-camel' : 'text-steel'}>{onShelf <= 0 ? 'sold out' : left > 0 ? `${left} left` : 'all in this sale'}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {products.data && !products.data.length && <p className="py-8 text-center text-sm text-steel">Nothing found.</p>}

          {today.data && today.data.sales.length > 0 && (
            <Card title="Today in the shop">
              <ul className="divide-y divide-seam/60">
                {today.data.sales.map((o) => (
                  <li key={o.id} className={cn('flex items-center gap-3 py-3 first:pt-0 last:pb-0', o.status === 'CANCELLED' && 'opacity-40')}>
                    <span className="w-12 font-mono text-xs text-steel">{timeOf(o.createdAt)}</span>
                    <Link to={`/admin/orders/${o.id}`} className="min-w-0 flex-1 truncate text-sm hover:text-camel">
                      {o.items.map((i) => [i.name, i.size].filter(Boolean).join(' ') + (i.quantity > 1 ? ` ×${i.quantity}` : '')).join(', ')}
                    </Link>
                    <span className="font-mono text-sm">{o.status === 'CANCELLED' ? 'undone' : num(o.total)}</span>
                    {undoable(o) && (
                      <button
                        onClick={() => window.confirm('Undo this sale? The items go back in stock.') && undo.mutate(o.id)}
                        className="rounded-full p-1.5 text-steel hover:text-danger"
                        aria-label="Undo sale"
                        title="Undo sale"
                      >
                        <Undo2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Ticket: side panel on desktop, bottom bar + sheet on phones */}
        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <Card title={`Sale${count ? ` · ${count}` : ''}`}>
              <Ticket lines={lines} setLines={setLines} methods={methods} onDone={finished} />
            </Card>
          </div>
        </aside>
      </div>

      {count > 0 && (
        <div onMouseDown={(e) => e.preventDefault()} /* keep the field focused: the keyboard stays, the bar doesn't jump under the finger */ className="fixed inset-x-0 bottom-0 z-30 border-t border-seam bg-ink/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
          <button onClick={() => setTicketOpen(true)} className="flex h-14 w-full items-center justify-between rounded-full bg-camel px-6 text-ink">
            <span className="font-semibold">
              {count} item{count === 1 ? '' : 's'}
            </span>
            <span className="font-mono font-semibold">{birr(total)} ›</span>
          </button>
        </div>
      )}
      <Sheet open={ticketOpen} onClose={() => setTicketOpen(false)} title="Sale">
        <Ticket lines={lines} setLines={setLines} methods={methods} onDone={finished} />
      </Sheet>

      {picking && <PickSize product={picking} inTicket={inTicket} onPick={(v) => add(picking, v)} onClose={() => setPicking(null)} />}
    </div>
  );
}
