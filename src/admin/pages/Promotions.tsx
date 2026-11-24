import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Gift, Percent, Plus, Search, Sparkles, Tag, Trash2, Users, X } from 'lucide-react';
import { Button, Input, PageLoader, Sheet } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, cn } from '../../lib/format';
import type { Category } from '../../lib/types';
import type { AdminProduct } from '../types';
import { adminApi } from '../ui';

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong');

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-camel' : 'bg-seam')}
    >
      <span className={cn('absolute left-0 top-1 size-5 rounded-full bg-chalk shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

function Chips<T extends string | number>({ value, options, onChange, format }: { value: T; options: T[]; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          className={cn('h-9 rounded-full border px-3.5 font-mono text-sm transition-colors', value === o ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel hover:text-chalk')}
        >
          {format ? format(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <p className="mb-2 text-[0.8rem] text-steel">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-steel">{hint}</p>}
    </div>
  );
}

// ─── Campaigns & codes ───────────────────────────────────

interface Promo {
  id: string;
  name: string;
  code: string | null;
  type: 'PERCENT' | 'FIXED' | 'GIFT';
  value: number;
  giftText: string | null;
  minSubtotal: number;
  categorySlug: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  onePerCustomer: boolean;
  bannerEn: string | null;
  bannerAm: string | null;
  stats?: { orders: number; revenue: number };
}

const offerText = (p: Pick<Promo, 'type' | 'value' | 'giftText'>) => (p.type === 'PERCENT' ? `${p.value}% off` : p.type === 'FIXED' ? `${birr(p.value)} off` : `🎁 ${p.giftText ?? 'Gift'}`);

function promoState(p: Promo) {
  const now = Date.now();
  if (!p.isActive) return { label: 'Off', tone: 'text-steel' };
  if (p.maxUses !== null && p.usedCount >= p.maxUses) return { label: 'Used up', tone: 'text-steel' };
  if (p.endsAt && new Date(p.endsAt).getTime() <= now) return { label: 'Ended', tone: 'text-steel' };
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return { label: `Starts ${new Date(p.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, tone: 'text-camel' };
  return { label: 'Running', tone: 'text-ok' };
}

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

const EMPTY: Omit<Promo, 'id' | 'usedCount'> = {
  name: '',
  code: null,
  type: 'PERCENT',
  value: 10,
  giftText: null,
  minSubtotal: 0,
  categorySlug: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  maxUses: null,
  onePerCustomer: true,
  bannerEn: null,
  bannerAm: null,
};

function PromoSheet({ initial, categories, onClose }: { initial: Promo | null; categories: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [p, setP] = useState(() => (initial ? { ...initial } : { ...EMPTY }));
  const [needsCode, setNeedsCode] = useState(Boolean(initial?.code));
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: p.name,
        code: needsCode ? p.code : null,
        type: p.type,
        value: p.type === 'GIFT' ? 0 : p.value,
        giftText: p.type === 'GIFT' ? p.giftText : null,
        minSubtotal: p.minSubtotal,
        categorySlug: p.categorySlug,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        isActive: p.isActive,
        maxUses: p.maxUses,
        onePerCustomer: p.onePerCustomer,
        bannerEn: needsCode ? null : p.bannerEn,
        bannerAm: needsCode ? null : p.bannerAm,
      };
      return initial ? adminApi(`/promotions/${initial.id}`, { method: 'PUT', body }) : adminApi('/promotions', { body });
    },
    onSuccess: () => {
      toast.ok('Saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'promotions'] });
      onClose();
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  const remove = useMutation({
    mutationFn: () => adminApi<{ archived: boolean }>(`/promotions/${initial!.id}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      toast.ok(r.archived ? 'Switched off (it was used on orders)' : 'Deleted');
      void qc.invalidateQueries({ queryKey: ['admin', 'promotions'] });
      onClose();
    },
  });
  const valid = p.name.trim().length >= 2 && (!needsCode || (p.code?.length ?? 0) >= 3) && (p.type === 'GIFT' ? Boolean(p.giftText) : p.value > 0);

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? 'Edit offer' : 'New offer'}
      footer={
        <div className="flex gap-2">
          {initial && (
            <Button variant="ghost" className="text-danger" onClick={() => window.confirm('Delete this offer?') && remove.mutate()}>
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button variant="accent" block disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Input name="pname" label="Name (customers see it)" placeholder="e.g. Eid Mubarak" value={p.name} onChange={(e) => set('name', e.target.value)} className="h-14 text-lg" />

        <Field label="Who gets it">
          <div className="grid grid-cols-2 gap-2">
            {[
              [false, 'Everyone', 'Applies by itself'],
              [true, 'With a code', 'They type the code'],
            ].map(([v, title, sub]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setNeedsCode(v as boolean)}
                className={cn('rounded-xl border p-3 text-left transition-colors', needsCode === v ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel hover:text-chalk')}
              >
                <span className="block text-sm font-medium">{title as string}</span>
                <span className="block text-xs opacity-70">{sub as string}</span>
              </button>
            ))}
          </div>
          {needsCode && (
            <input
              value={p.code ?? ''}
              onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24))}
              placeholder="EID2026"
              className="mt-3 h-12 w-full rounded-xl border border-seam bg-ink/40 px-4 font-mono text-lg uppercase tracking-widest focus:border-camel focus:outline-none"
            />
          )}
        </Field>

        <Field label="Offer">
          <Chips
            value={p.type}
            options={['PERCENT', 'FIXED', 'GIFT'] as Promo['type'][]}
            onChange={(v) => set('type', v)}
            format={(v) => (v === 'PERCENT' ? '% off' : v === 'FIXED' ? 'ETB off' : 'Free gift')}
          />
          <div className="mt-3">
            {p.type === 'PERCENT' && <Chips value={p.value} options={[5, 10, 15, 20, 25, 30]} onChange={(v) => set('value', v)} format={(v) => `${v}%`} />}
            {p.type === 'FIXED' && (
              <Input name="pvalue" inputMode="numeric" placeholder="500" value={p.value ? String(p.value) : ''} onChange={(e) => set('value', Number(e.target.value.replace(/\D/g, '')) || 0)} className="font-mono" />
            )}
            {p.type === 'GIFT' && <Input name="pgift" placeholder="e.g. Free perfume sample" value={p.giftText ?? ''} onChange={(e) => set('giftText', e.target.value || null)} />}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Input name="pmin" label="Minimum order (ETB)" inputMode="numeric" placeholder="0" value={p.minSubtotal ? String(p.minSubtotal) : ''} onChange={(e) => set('minSubtotal', Number(e.target.value.replace(/\D/g, '')) || 0)} />
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] text-steel">Only for</span>
            <select value={p.categorySlug ?? ''} onChange={(e) => set('categorySlug', e.target.value || null)} className="h-12 w-full rounded-xl border border-seam bg-wool px-3 text-chalk">
              <option value="">Everything</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </label>
          <Input name="pstart" label="Starts" type="datetime-local" value={toLocal(p.startsAt)} onChange={(e) => set('startsAt', fromLocal(e.target.value))} />
          <Input name="pend" label="Ends" type="datetime-local" value={toLocal(p.endsAt)} onChange={(e) => set('endsAt', fromLocal(e.target.value))} />
          <Input name="pmax" label="Limit (orders)" inputMode="numeric" placeholder="No limit" value={p.maxUses ? String(p.maxUses) : ''} onChange={(e) => set('maxUses', Number(e.target.value.replace(/\D/g, '')) || null)} />
        </div>

        {!needsCode && (
          <div className="grid gap-3">
            <Input name="pbanner" label="Banner at the top of the shop (optional)" placeholder="EID MUBARAK · 15% OFF EVERYTHING" value={p.bannerEn ?? ''} onChange={(e) => set('bannerEn', e.target.value || null)} />
            <Input name="pbannerAm" label="Banner in Amharic" value={p.bannerAm ?? ''} onChange={(e) => set('bannerAm', e.target.value || null)} />
          </div>
        )}

        <div className="divide-y divide-seam/60 rounded-2xl border border-seam/80">
          <label className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm">Once per customer</span>
            <Switch checked={p.onePerCustomer} onChange={(v) => set('onePerCustomer', v)} />
          </label>
          <label className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm">Active</span>
            <Switch checked={p.isActive} onChange={(v) => set('isActive', v)} />
          </label>
        </div>
        <p className="text-xs text-steel">One offer per order — the customer always gets the best one. “Complete the look” savings come on top.</p>
      </div>
    </Sheet>
  );
}

function CampaignsTab() {
  const q = useQuery({ queryKey: ['admin', 'promotions'], queryFn: () => adminApi<{ promotions: Promo[] }>('/promotions').then((r) => r.promotions) });
  const cats = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => adminApi<{ categories: Category[] }>('/categories').then((r) => r.categories) });
  const [editing, setEditing] = useState<Promo | null | 'new'>(null);
  if (q.isLoading) return <PageLoader />;
  return (
    <div className="space-y-4">
      <button
        onClick={() => setEditing('new')}
        className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-camel/50 bg-camel/[0.04] p-4 text-left transition-colors hover:border-camel"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-camel text-ink">
          <Plus className="size-5" />
        </span>
        <span>
          <span className="block">New offer</span>
          <span className="block text-xs text-steel">Holiday sale, promo code, free gift…</span>
        </span>
      </button>
      {q.data?.map((p) => {
        const st = promoState(p);
        return (
          <button key={p.id} onClick={() => setEditing(p)} className="flex w-full items-center gap-4 rounded-2xl border border-seam/80 bg-wool p-4 text-left transition-colors hover:border-steel">
            <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', p.type === 'GIFT' ? 'bg-camel/15 text-camel' : 'bg-ok/15 text-ok')}>
              {p.type === 'GIFT' ? <Gift className="size-5" /> : p.code ? <Tag className="size-5" /> : <Percent className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate">{p.name}</span>
                {p.code && <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-xs">{p.code}</span>}
              </span>
              <span className="mt-0.5 block text-xs text-steel">
                {offerText(p)}
                {p.minSubtotal ? ` · from ${birr(p.minSubtotal)}` : ''}
                {p.categorySlug ? ` · ${p.categorySlug}` : ''}
              </span>
            </span>
            <span className="text-right">
              <span className={cn('block text-xs', st.tone)}>{st.label}</span>
              <span className="mt-0.5 block font-mono text-xs text-steel">
                {p.stats?.orders ?? 0} orders{p.maxUses ? ` / ${p.maxUses}` : ''}
              </span>
            </span>
          </button>
        );
      })}
      {editing && <PromoSheet initial={editing === 'new' ? null : editing} categories={cats.data ?? []} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Looks ───────────────────────────────────────────────

interface BundleRow {
  id: string;
  name: string;
  nameAm: string | null;
  discountPercent: number;
  isActive: boolean;
  products: { id: string; nameEn: string; basePrice: number; status: string; image: string | null }[];
}

function LookSheet({ initial, onClose }: { initial: BundleRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [nameAm, setNameAm] = useState(initial?.nameAm ?? '');
  const [pct, setPct] = useState(initial?.discountPercent ?? 10);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [items, setItems] = useState(initial?.products ?? []);
  const [q, setQ] = useState('');
  const search = useQuery({
    queryKey: ['admin', 'look-search', q],
    queryFn: () => adminApi<{ products: AdminProduct[] }>('/products', { query: { q: q || undefined, status: 'ACTIVE', limit: 12 } }).then((r) => r.products),
    enabled: items.length < 5,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { name, nameAm: nameAm || null, discountPercent: pct, isActive: active, productIds: items.map((i) => i.id) };
      return initial ? adminApi(`/bundles/${initial.id}`, { method: 'PUT', body }) : adminApi('/bundles', { body });
    },
    onSuccess: () => {
      toast.ok('Saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'bundles'] });
      onClose();
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  const remove = useMutation({
    mutationFn: () => adminApi(`/bundles/${initial!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'bundles'] });
      onClose();
    },
  });
  const full = items.reduce((n, i) => n + i.basePrice, 0);

  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? 'Edit look' : 'New look'}
      footer={
        <div className="flex gap-2">
          {initial && (
            <Button variant="ghost" className="text-danger" onClick={() => window.confirm('Delete this look?') && remove.mutate()}>
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button variant="accent" block disabled={name.trim().length < 2 || items.length < 2} loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Input name="lname" label="Name" placeholder="e.g. The wedding look" value={name} onChange={(e) => setName(e.target.value)} className="h-14 text-lg" />
        <Input name="lnameAm" label="Name in Amharic" value={nameAm} onChange={(e) => setNameAm(e.target.value)} />
        <Field label="Discount when bought together">
          <Chips value={pct} options={[5, 10, 15, 20]} onChange={setPct} format={(v) => `${v}%`} />
        </Field>
        <Field label={`Pieces (${items.length}/5)`} hint={items.length >= 2 ? `Together ${birr(full - Math.round((full * pct) / 100))} instead of ${birr(full)}` : 'Pick 2 to 5 products'}>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-seam/70 p-2">
                {i.image ? <img src={i.image} alt="" className="aspect-[4/5] w-10 rounded-md object-cover" /> : <span className="aspect-[4/5] w-10 rounded-md bg-wool-2" />}
                <span className="min-w-0 flex-1 truncate text-sm">{i.nameEn}</span>
                <span className="font-mono text-xs text-steel">{birr(i.basePrice)}</span>
                <button onClick={() => setItems((all) => all.filter((x) => x.id !== i.id))} className="p-1.5 text-steel hover:text-danger" aria-label="Remove">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </Field>
        {items.length < 5 && (
          <div>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-seam bg-ink/40 px-3 focus-within:border-camel">
              <Search className="size-4 text-steel" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a product" className="h-full flex-1 bg-transparent text-sm focus:outline-none" />
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(search.data ?? [])
                .filter((p) => !items.some((i) => i.id === p.id))
                .slice(0, 9)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setItems((all) => [...all, { id: p.id, nameEn: p.nameEn, basePrice: p.basePrice, status: p.status, image: p.images[0]?.urls.sm ?? null }])}
                    className="overflow-hidden rounded-xl border border-seam text-left hover:border-camel"
                  >
                    {p.images[0] ? <img src={p.images[0].urls.sm} alt="" className="aspect-[4/5] w-full object-cover" /> : <span className="block aspect-[4/5] bg-wool-2" />}
                    <span className="block truncate px-2 py-1.5 text-[0.7rem]">{p.nameEn}</span>
                  </button>
                ))}
            </div>
          </div>
        )}
        <label className="flex items-center justify-between rounded-xl border border-seam/80 px-4 py-3">
          <span className="text-sm">Show in the shop</span>
          <Switch checked={active} onChange={setActive} />
        </label>
      </div>
    </Sheet>
  );
}

function LooksTab() {
  const q = useQuery({ queryKey: ['admin', 'bundles'], queryFn: () => adminApi<{ bundles: BundleRow[] }>('/bundles').then((r) => r.bundles) });
  const [editing, setEditing] = useState<BundleRow | null | 'new'>(null);
  if (q.isLoading) return <PageLoader />;
  return (
    <div className="space-y-4">
      <button
        onClick={() => setEditing('new')}
        className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-camel/50 bg-camel/[0.04] p-4 text-left transition-colors hover:border-camel"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-camel text-ink">
          <Plus className="size-5" />
        </span>
        <span>
          <span className="block">New look</span>
          <span className="block text-xs text-steel">Suit + shirt + shoes — shown on each piece’s page, cheaper together</span>
        </span>
      </button>
      {q.data?.map((b) => (
        <button key={b.id} onClick={() => setEditing(b)} className={cn('flex w-full items-center gap-4 rounded-2xl border border-seam/80 bg-wool p-4 text-left hover:border-steel', !b.isActive && 'opacity-50')}>
          <span className="flex -space-x-3">
            {b.products.slice(0, 4).map((p) =>
              p.image ? <img key={p.id} src={p.image} alt="" className="aspect-[4/5] w-11 rounded-md border-2 border-wool object-cover" /> : <span key={p.id} className="aspect-[4/5] w-11 rounded-md border-2 border-wool bg-wool-2" />,
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{b.name}</span>
            <span className="block text-xs text-steel">{b.products.length} pieces</span>
          </span>
          <span className="rounded-full bg-ok/15 px-2.5 py-1 font-mono text-xs text-ok">−{b.discountPercent}%</span>
        </button>
      ))}
      {editing && <LookSheet initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Rewards ─────────────────────────────────────────────

interface RewardSettings {
  loyaltyEnabled: boolean;
  loyaltyPercent: number;
  referralEnabled: boolean;
  referralReward: number;
  referralFriendDiscount: number;
  referralMinSubtotal: number;
  creditMaxPercent: number;
}

function MoneyInput({ value, onSave, label }: { value: number; onSave: (v: number) => void; label: string }) {
  const [v, setV] = useState(String(value));
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-steel">{label}</span>
      <span className="flex items-center gap-2">
        <input
          value={v}
          inputMode="numeric"
          onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 7))}
          onBlur={() => Number(v) !== value && onSave(Number(v) || 0)}
          className="h-9 w-24 rounded-lg border border-seam bg-ink/40 px-2 text-right font-mono focus:border-camel focus:outline-none"
        />
        <span className="font-mono text-xs text-steel">ETB</span>
      </span>
    </label>
  );
}

function RewardsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi<{ settings: RewardSettings }>('/settings') });
  const patch = useMutation({
    mutationFn: (body: Partial<RewardSettings>) => adminApi('/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast.ok('Saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  const s = q.data?.settings;
  if (!s) return <PageLoader />;
  return (
    <div className="space-y-8">
      <section>
        <h2 className="label mb-2.5 px-1">Loyalty</h2>
        <div className="divide-y divide-seam/60 overflow-hidden rounded-2xl border border-seam/80 bg-wool">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <span className="grid size-10 place-items-center rounded-xl bg-camel/15 text-camel">
              <Crown className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">Credit back on every order</span>
              <span className="block text-xs text-steel">Given when the order is delivered / picked up. Gold (50k+ spent) earns 1.5×, VIP (150k+) 2×.</span>
            </span>
            <Switch checked={s.loyaltyEnabled} onChange={(v) => patch.mutate({ loyaltyEnabled: v })} />
          </div>
          {s.loyaltyEnabled && (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-steel">Credit back</span>
              <Chips value={s.loyaltyPercent} options={[1, 2, 3, 5]} onChange={(v) => patch.mutate({ loyaltyPercent: v })} format={(v) => `${v}%`} />
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="label mb-2.5 px-1">Invite a friend</h2>
        <div className="divide-y divide-seam/60 overflow-hidden rounded-2xl border border-seam/80 bg-wool">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <span className="grid size-10 place-items-center rounded-xl bg-camel/15 text-camel">
              <Users className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">Customers invite friends</span>
              <span className="block text-xs text-steel">Each customer gets a personal link in “My orders”. Friend saves on the first order; the inviter gets credit once it’s received.</span>
            </span>
            <Switch checked={s.referralEnabled} onChange={(v) => patch.mutate({ referralEnabled: v })} />
          </div>
          {s.referralEnabled && (
            <>
              <MoneyInput label="Friend saves" value={s.referralFriendDiscount} onSave={(v) => patch.mutate({ referralFriendDiscount: v })} />
              <MoneyInput label="Inviter gets (credit)" value={s.referralReward} onSave={(v) => patch.mutate({ referralReward: v })} />
              <MoneyInput label="Friend’s first order from" value={s.referralMinSubtotal} onSave={(v) => patch.mutate({ referralMinSubtotal: v })} />
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="label mb-2.5 px-1">Using credit</h2>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-seam/80 bg-wool px-4 py-3.5">
          <span>
            <span className="block text-sm">Credit can pay up to</span>
            <span className="block text-xs text-steel">of an order</span>
          </span>
          <Chips value={s.creditMaxPercent} options={[25, 50, 100]} onChange={(v) => patch.mutate({ creditMaxPercent: v })} format={(v) => `${v}%`} />
        </div>
      </section>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

const TABS = [
  { id: 'offers', label: 'Offers & codes', icon: Tag },
  { id: 'looks', label: 'Looks', icon: Sparkles },
  { id: 'rewards', label: 'Rewards', icon: Crown },
] as const;

export default function Promotions() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'offers';
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="display text-[1.75rem] md:text-[2.25rem]">Promotions</h1>
      <div className="no-scrollbar mb-8 mt-5 overflow-x-auto">
        <div className="flex w-max gap-1 rounded-full border border-seam/80 bg-wool p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setParams({ tab: id }, { replace: true })}
              className={cn('flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors', tab === id ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'offers' && <CampaignsTab />}
      {tab === 'looks' && <LooksTab />}
      {tab === 'rewards' && <RewardsTab />}
    </div>
  );
}
