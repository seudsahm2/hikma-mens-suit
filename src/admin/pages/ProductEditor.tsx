import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, Megaphone, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Plus, Send, Trash2, X } from 'lucide-react';
import { Button, ErrorState, Input, PageLoader, Textarea } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, sortSizes } from '../../lib/format';
import type { Category } from '../../lib/types';
import type { AdminProduct } from '../types';
import { adminApi, Card, Select, Toggle } from '../ui';

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const int = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\D/g, '')));

interface Form {
  nameEn: string;
  nameAm: string;
  categoryId: string;
  brandName: string;
  basePrice: string;
  compareAtPrice: string;
  costPrice: string;
  origin: string;
  material: string;
  fit: string;
  descriptionEn: string;
  descriptionAm: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isFeatured: boolean;
  isNewArrival: boolean;
  badge: string;
  tags: string;
  concentration: string;
  volumeMl: string;
  scentFamily: string;
  notesTop: string;
  notesHeart: string;
  notesBase: string;
  tikTokUrl: string;
}

const empty: Form = {
  nameEn: '',
  nameAm: '',
  categoryId: '',
  brandName: '',
  basePrice: '',
  compareAtPrice: '',
  costPrice: '',
  origin: '',
  material: '',
  fit: '',
  descriptionEn: '',
  descriptionAm: '',
  status: 'DRAFT',
  isFeatured: false,
  isNewArrival: true,
  badge: '',
  tags: '',
  concentration: '',
  volumeMl: '',
  scentFamily: '',
  notesTop: '',
  notesHeart: '',
  notesBase: '',
  tikTokUrl: '',
};

function toForm(p: AdminProduct): Form {
  return {
    nameEn: p.nameEn,
    nameAm: p.nameAm ?? '',
    categoryId: p.categoryId,
    brandName: p.brand?.name ?? '',
    basePrice: String(p.basePrice),
    compareAtPrice: p.compareAtPrice?.toString() ?? '',
    costPrice: p.costPrice?.toString() ?? '',
    origin: p.origin ?? '',
    material: p.material ?? '',
    fit: p.fit ?? '',
    descriptionEn: p.descriptionEn ?? '',
    descriptionAm: p.descriptionAm ?? '',
    status: p.status,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    badge: p.badge ?? '',
    tags: p.tags.join(', '),
    concentration: p.concentration ?? '',
    volumeMl: p.volumeMl?.toString() ?? '',
    scentFamily: p.scentFamily ?? '',
    notesTop: p.notesTop.join(', '),
    notesHeart: p.notesHeart.join(', '),
    notesBase: p.notesBase.join(', '),
    tikTokUrl: p.tikTokUrl ?? '',
  };
}

function toPayload(f: Form) {
  return {
    nameEn: f.nameEn,
    nameAm: f.nameAm || null,
    categoryId: f.categoryId,
    brandName: f.brandName || null,
    basePrice: int(f.basePrice) ?? 0,
    compareAtPrice: int(f.compareAtPrice),
    costPrice: int(f.costPrice),
    origin: f.origin || null,
    material: f.material || null,
    fit: f.fit || null,
    descriptionEn: f.descriptionEn || null,
    descriptionAm: f.descriptionAm || null,
    status: f.status,
    isFeatured: f.isFeatured,
    isNewArrival: f.isNewArrival,
    badge: f.badge || null,
    tags: list(f.tags.toLowerCase()),
    concentration: f.concentration || null,
    volumeMl: int(f.volumeMl),
    scentFamily: f.scentFamily || null,
    notesTop: list(f.notesTop),
    notesHeart: list(f.notesHeart),
    notesBase: list(f.notesBase),
    tikTokUrl: f.tikTokUrl || null,
  };
}

// ─── Photos ──────────────────────────────────────────────

function Photos({ product, onChange }: { product: AdminProduct; onChange: (p: AdminProduct) => void }) {
  const [busy, setBusy] = useState(false);
  const colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))];

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const form = new FormData();
      [...files].slice(0, 12).forEach((f) => form.append('images', f));
      const r = await adminApi<{ product: AdminProduct }>(`/products/${product.id}/images`, { form });
      onChange(r.product);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };
  const move = async (index: number, dir: -1 | 1) => {
    const ids = product.images.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    const r = await adminApi<{ product: AdminProduct }>(`/products/${product.id}/images/order`, { method: 'PUT', body: { imageIds: ids } });
    onChange(r.product);
  };
  const remove = async (imageId: string) => {
    if (!window.confirm('Delete this photo?')) return;
    const r = await adminApi<{ product: AdminProduct }>(`/products/${product.id}/images/${imageId}`, { method: 'DELETE' });
    onChange(r.product);
  };
  const setColor = async (imageId: string, color: string) => {
    const r = await adminApi<{ product: AdminProduct }>(`/products/${product.id}/images/${imageId}`, { method: 'PATCH', body: { color: color || null } });
    onChange(r.product);
  };

  return (
    <Card title="Photos" action={<span className="text-xs text-steel">First photo is the cover</span>}>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {product.images.map((img, i) => (
          <div key={img.id} className="group relative">
            <img src={img.urls.sm} alt="" className="aspect-[4/5] w-full rounded-lg object-cover" />
            <div className="absolute inset-x-1 top-1 flex justify-between opacity-100 md:opacity-0 md:group-hover:opacity-100">
              <div className="flex gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded-full bg-ink/80 disabled:opacity-30" aria-label="Move left">
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === product.images.length - 1}
                  className="grid size-7 place-items-center rounded-full bg-ink/80 disabled:opacity-30"
                  aria-label="Move right"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <button onClick={() => remove(img.id)} className="grid size-7 place-items-center rounded-full bg-ink/80 text-danger" aria-label="Delete photo">
                <Trash2 className="size-3.5" />
              </button>
            </div>
            {colors.length > 1 && (
              <select
                value={img.color ?? ''}
                onChange={(e) => setColor(img.id, e.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-seam bg-ink px-1 text-xs"
                aria-label="Photo colour"
              >
                <option value="">Any colour</option>
                {colors.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        ))}
        <label
          className={cn(
            'flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-seam text-xs text-steel hover:border-steel',
            busy && 'pointer-events-none opacity-50',
          )}
        >
          <ImagePlus className="size-6" />
          {busy ? 'Uploading…' : 'Add photos'}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
    </Card>
  );
}

// ─── Stock grid (sizes × colours) ────────────────────────

function StockGrid({ product, category, onChange }: { product: AdminProduct; category?: Category; onChange: (p: AdminProduct) => void }) {
  const hasSizes = (category?.sizes.length ?? 0) > 0 || product.variants.some((v) => v.size);
  const init = () => {
    const active = product.variants.filter((v) => v.isActive);
    const sizes = sortSizes([...new Set(active.map((v) => v.size).filter(Boolean))]);
    const colorMap = new Map<string, string>();
    active.forEach((v) => v.color && !colorMap.has(v.color) && colorMap.set(v.color, v.colorHex ?? '#888888'));
    const stock: Record<string, string> = {};
    active.forEach((v) => (stock[`${v.size}|${v.color}`] = String(v.stock)));
    return { sizes, colors: [...colorMap].map(([name, hex]) => ({ name, hex })), stock };
  };
  const [state, setState] = useState(init);
  const [newColor, setNewColor] = useState({ name: '', hex: '#1a1a1a' });
  const [customSize, setCustomSize] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setState(init()), [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sizes = hasSizes ? state.sizes : [''];
  const colors = state.colors.length ? state.colors : [{ name: '', hex: '' }];
  const available = sortSizes([...new Set([...(category?.sizes ?? []), ...state.sizes])]);

  const toggleSize = (s: string) =>
    setState((st) => ({ ...st, sizes: st.sizes.includes(s) ? st.sizes.filter((x) => x !== s) : sortSizes([...st.sizes, s]) }));
  const addColor = () => {
    const name = newColor.name.trim();
    if (!name || state.colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    setState((st) => ({ ...st, colors: [...st.colors, { name, hex: newColor.hex }] }));
    setNewColor({ name: '', hex: '#1a1a1a' });
  };

  const save = async () => {
    if (hasSizes && !state.sizes.length) return toast.error('Pick at least one size');
    setSaving(true);
    try {
      const existing = new Map(product.variants.map((v) => [`${v.size}|${v.color}`, v]));
      const variants = sizes.flatMap((size) =>
        colors.map((c) => {
          const key = `${size}|${c.name}`;
          return {
            size,
            color: c.name,
            colorHex: c.hex || null,
            price: existing.get(key)?.price ?? null,
            stock: Number(state.stock[key] || 0),
            isActive: true,
          };
        }),
      );
      const r = await adminApi<{ product: AdminProduct }>(`/products/${product.id}/variants`, { method: 'PUT', body: { variants } });
      onChange(r.product);
      toast.ok('Stock saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const total = sizes.reduce((n, s) => n + colors.reduce((m, c) => m + Number(state.stock[`${s}|${c.name}`] || 0), 0), 0);
  // Customers waiting for sold-out sizes ("Notify me when back")
  const waiting = product.variants
    .filter((v) => (v._count?.alerts ?? 0) > 0)
    .map((v) => ({ label: [v.size, v.color].filter(Boolean).join(' / ') || 'this item', count: v._count!.alerts }));

  return (
    <Card title="Sizes, colours & stock" action={<span className="font-mono text-xs text-steel">{total} pcs</span>}>
      {hasSizes && (
        <div>
          <p className="label mb-2">Sizes</p>
          <div className="flex flex-wrap gap-2">
            {available.map((s) => (
              <button
                key={s}
                onClick={() => toggleSize(s)}
                className={cn('h-9 min-w-11 rounded-md border px-2.5 font-mono text-sm', state.sizes.includes(s) ? 'border-camel bg-camel text-ink' : 'border-seam text-steel')}
              >
                {s}
              </button>
            ))}
            <span className="flex">
              <input
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="Other"
                className="h-9 w-20 rounded-l-md border border-seam bg-ink px-2 font-mono text-sm"
              />
              <button
                onClick={() => {
                  if (customSize.trim()) toggleSize(customSize.trim());
                  setCustomSize('');
                }}
                className="h-9 rounded-r-md border border-l-0 border-seam px-2 text-steel"
                aria-label="Add size"
              >
                <Plus className="size-4" />
              </button>
            </span>
          </div>
        </div>
      )}

      <div className={hasSizes ? 'mt-6' : ''}>
        <p className="label mb-2">Colours</p>
        <div className="flex flex-wrap items-center gap-2">
          {state.colors.map((c) => (
            <span key={c.name} className="flex h-9 items-center gap-2 rounded-full border border-seam pl-1.5 pr-1 text-sm">
              <span className="size-6 rounded-full ring-1 ring-inset ring-white/15" style={{ background: c.hex }} />
              {c.name}
              <button
                onClick={() => setState((st) => ({ ...st, colors: st.colors.filter((x) => x.name !== c.name) }))}
                className="grid size-6 place-items-center rounded-full text-steel hover:text-danger"
                aria-label={`Remove ${c.name}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <input type="color" value={newColor.hex} onChange={(e) => setNewColor((n) => ({ ...n, hex: e.target.value }))} className="size-9 rounded-md border border-seam bg-ink" aria-label="Colour" />
            <input
              value={newColor.name}
              onChange={(e) => setNewColor((n) => ({ ...n, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addColor()}
              placeholder="e.g. Navy"
              className="h-9 w-28 rounded-md border border-seam bg-ink px-2 text-sm"
            />
            <Button variant="outline" size="sm" onClick={addColor} disabled={!newColor.name.trim()}>
              Add
            </Button>
          </span>
        </div>
        {!state.colors.length && <p className="mt-2 text-xs text-steel">No colours: one colour only.</p>}
      </div>

      {(!hasSizes || state.sizes.length > 0) && (
        <div className="mt-6 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="pb-2 pr-3 text-left text-xs font-normal text-steel">{state.colors.length ? 'Colour' : ''}</th>
                {sizes.map((s) => (
                  <th key={s} className="px-1 pb-2 font-mono text-xs font-normal text-steel">
                    {s || 'Stock'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {colors.map((c) => (
                <tr key={c.name}>
                  <td className="py-1 pr-3 text-steel">{c.name}</td>
                  {sizes.map((s) => {
                    const key = `${s}|${c.name}`;
                    return (
                      <td key={key} className="px-1 py-1">
                        <input
                          value={state.stock[key] ?? ''}
                          onChange={(e) => setState((st) => ({ ...st, stock: { ...st.stock, [key]: e.target.value.replace(/\D/g, '').slice(0, 5) } }))}
                          inputMode="numeric"
                          placeholder="0"
                          className="h-10 w-14 rounded-md border border-seam bg-ink text-center font-mono focus:border-camel focus:outline-none"
                          aria-label={`Stock ${s} ${c.name}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {waiting.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-camel/[0.08] px-3 py-2.5 text-sm">
          <Bell className="mt-0.5 size-4 shrink-0 text-camel" />
          <span>
            {waiting.reduce((n, w) => n + w.count, 0)} waiting for{' '}
            <b>{waiting.map((w) => `${w.label} (${w.count})`).join(', ')}</b> — they get a Telegram message as soon as you add stock and save.
          </span>
        </p>
      )}
      <Button variant="accent" className="mt-5" loading={saving} onClick={save}>
        Save stock
      </Button>
    </Card>
  );
}

// ─── New-arrival announcement ────────────────────────────

interface BroadcastInfo {
  subscribers: number;
  last: { status: 'sending' | 'done' | 'cancelled'; total: number; sentCount: number; failedCount: number; createdAt: string } | null;
}

function Announce({ product }: { product: AdminProduct }) {
  const qc = useQueryClient();
  const info = useQuery({
    queryKey: ['admin', 'announce', product.id],
    queryFn: () => adminApi<BroadcastInfo>(`/products/${product.id}/announce`),
    refetchInterval: (q) => (q.state.data?.last?.status === 'sending' ? 2000 : false),
  });
  const send = useMutation({
    mutationFn: (force: boolean) => adminApi(`/products/${product.id}/announce`, { body: { force } }),
    onSuccess: () => {
      toast.ok('Sending to subscribers…');
      void qc.invalidateQueries({ queryKey: ['admin', 'announce', product.id] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'ALREADY_ANNOUNCED') {
        if (window.confirm('This product was already announced this week. Send again anyway?')) send.mutate(true);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    },
  });
  const d = info.data;
  const last = d?.last;
  return (
    <Card title="Announce to customers">
      <p className="text-sm text-steel">
        Sends this product’s photo, name and price with a <b className="text-chalk">View</b> button to everyone who asked for new arrivals on Telegram.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm">
          <Bell className="mr-1.5 inline size-4 text-camel" />
          {d ? `${d.subscribers} subscriber${d.subscribers === 1 ? '' : 's'}` : '…'}
        </p>
        <Button
          variant="primary"
          loading={send.isPending}
          disabled={product.status !== 'ACTIVE' || !product.images.length || !d?.subscribers || last?.status === 'sending'}
          onClick={() => send.mutate(false)}
        >
          <Megaphone className="size-4" /> Announce
        </Button>
      </div>
      {last && (
        <p className="mt-3 text-xs text-steel">
          {last.status === 'sending'
            ? `Sending… ${last.sentCount} of ${last.total}`
            : last.status === 'done'
              ? `Last sent ${new Date(last.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${last.sentCount} delivered${last.failedCount ? `, ${last.failedCount} unreachable` : ''}`
              : 'Last announcement was cancelled'}
        </p>
      )}
      {product.status !== 'ACTIVE' && <p className="mt-2 text-xs text-steel">Put the product on sale first.</p>}
      {d && !d.subscribers && (
        <p className="mt-2 text-xs text-steel">No subscribers yet — customers subscribe with the bot’s “🔔 New arrivals” button, /news, or on the website.</p>
      )}
    </Card>
  );
}

// ─── Telegram channel ────────────────────────────────────

function Publish({ product }: { product: AdminProduct }) {
  const qc = useQueryClient();
  const caption = useQuery({
    queryKey: ['admin', 'caption', product.id, product.updatedAt],
    queryFn: () => adminApi<{ caption: string }>(`/products/${product.id}/caption`).then((r) => r.caption),
  });
  const [text, setText] = useState('');
  useEffect(() => {
    if (caption.data) setText(caption.data);
  }, [caption.data]);
  const publish = useMutation({
    mutationFn: () => adminApi<{ postUrl: string }>(`/products/${product.id}/publish`, { body: { caption: text } }),
    onSuccess: () => {
      toast.ok('Posted to your Telegram channel');
      void qc.invalidateQueries({ queryKey: ['admin', 'product', product.id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  return (
    <Card
      title="Telegram channel post"
      action={
        product.telegramPostUrl ? (
          <a href={product.telegramPostUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-camel">
            Last post <ExternalLink className="size-3" />
          </a>
        ) : undefined
      }
    >
      <Textarea name="caption" rows={12} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[0.8rem] leading-relaxed" />
      <p className="mt-2 text-xs text-steel">Posted with the photos and an “Order now” button that opens this product in the Telegram shop.</p>
      <Button
        variant="primary"
        className="mt-4"
        loading={publish.isPending}
        disabled={product.status !== 'ACTIVE' || !product.images.length}
        onClick={() => publish.mutate()}
      >
        <Send className="size-4" /> Post to channel
      </Button>
      {product.status !== 'ACTIVE' && <p className="mt-2 text-xs text-steel">Put the product on sale first.</p>}
    </Card>
  );
}

// ─── Editor ──────────────────────────────────────────────

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(empty);

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminApi<{ categories: Category[] }>('/categories').then((r) => r.categories),
  });
  const productQ = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => adminApi<{ product: AdminProduct }>(`/products/${id}`).then((r) => r.product),
    enabled: !isNew,
  });
  const product = productQ.data;

  useEffect(() => {
    if (product) setForm(toForm(product));
  }, [product]);
  useEffect(() => {
    if (isNew && categories.data?.[0] && !form.categoryId) setForm((f) => ({ ...f, categoryId: categories.data[0]!.id }));
  }, [isNew, categories.data, form.categoryId]);

  const category = useMemo(() => categories.data?.find((c) => c.id === form.categoryId), [categories.data, form.categoryId]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setProduct = (p: AdminProduct) => {
    qc.setQueryData(['admin', 'product', p.id], p);
    void qc.invalidateQueries({ queryKey: ['admin', 'products'] });
  };

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? adminApi<{ product: AdminProduct }>('/products', { body: toPayload(form) })
        : adminApi<{ product: AdminProduct }>(`/products/${id}`, { method: 'PUT', body: toPayload(form) }),
    onSuccess: (r) => {
      setProduct(r.product);
      toast.ok(isNew ? 'Product created. Add photos and stock.' : 'Saved');
      if (isNew) navigate(`/admin/products/${r.product.id}`, { replace: true });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: () => adminApi<{ archived?: boolean }>(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      toast.ok(r.archived ? 'Archived (it has orders)' : 'Deleted');
      void qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      navigate('/admin/products');
    },
  });

  if (!isNew && productQ.isLoading) return <PageLoader />;
  if (!isNew && (productQ.error || !product)) return <ErrorState message="Product not found." />;

  const fragrance = category?.kind === 'FRAGRANCE';
  const canSave = form.nameEn.trim().length >= 2 && form.categoryId && form.basePrice;
  const margin = int(form.basePrice) && int(form.costPrice) ? Math.round(((int(form.basePrice)! - int(form.costPrice)!) / int(form.basePrice)!) * 100) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/products" className="inline-flex items-center gap-2 text-sm text-steel hover:text-chalk">
          <ArrowLeft className="size-4" /> Products
        </Link>
        {product && product.status === 'ACTIVE' && (
          <a href={`/p/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-camel">
            View in shop <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      <h1 className="display text-2xl">{isNew ? 'New product' : form.nameEn || 'Product'}</h1>

      {product && <Photos product={product} onChange={setProduct} />}

      <Card title="Basics">
        <div className="grid gap-4 md:grid-cols-2">
          <Input name="nameEn" label="Name (English)" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
          <Input name="nameAm" label="Name (Amharic)" value={form.nameAm} onChange={(e) => set('nameAm', e.target.value)} />
          <Select
            label="Category"
            value={form.categoryId}
            onChange={(v) => set('categoryId', v)}
            options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.nameEn }))}
          />
          <Input name="brand" label="Brand" placeholder="Skechers, Ibraq…" value={form.brandName} onChange={(e) => set('brandName', e.target.value)} />
          <Input name="basePrice" label="Price (ETB)" inputMode="numeric" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value.replace(/\D/g, ''))} />
          <Input
            name="compareAtPrice"
            label="Old price (shows crossed out)"
            inputMode="numeric"
            value={form.compareAtPrice}
            onChange={(e) => set('compareAtPrice', e.target.value.replace(/\D/g, ''))}
          />
          <Input
            name="costPrice"
            label="Cost price (private)"
            inputMode="numeric"
            value={form.costPrice}
            onChange={(e) => set('costPrice', e.target.value.replace(/\D/g, ''))}
            hint={margin !== null ? `Margin ${margin}%` : 'Used for profit reports. Customers never see it.'}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(v) => set('status', v as Form['status'])}
            options={[
              { value: 'DRAFT', label: 'Draft (hidden)' },
              { value: 'ACTIVE', label: 'On sale' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
          />
        </div>
        <div className="mt-4 grid gap-x-8 md:grid-cols-2">
          <Toggle checked={form.isNewArrival} onChange={(v) => set('isNewArrival', v)} label="New in" hint="Shown in the New in row" />
          <Toggle checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} label="Top pick" hint="Shown on the home page" />
        </div>
      </Card>

      <Card title="Details">
        <div className="grid gap-4 md:grid-cols-3">
          <Input name="origin" label="Made in" placeholder="Turkey" value={form.origin} onChange={(e) => set('origin', e.target.value)} />
          {!fragrance && <Input name="material" label="Fabric" placeholder="100% cotton" value={form.material} onChange={(e) => set('material', e.target.value)} />}
          {!fragrance && <Input name="fit" label="Fit" placeholder="Slim / Regular" value={form.fit} onChange={(e) => set('fit', e.target.value)} />}
          {fragrance && (
            <>
              <Input name="volumeMl" label="Volume (ml)" inputMode="numeric" value={form.volumeMl} onChange={(e) => set('volumeMl', e.target.value.replace(/\D/g, ''))} />
              <Input name="concentration" label="Type" placeholder="EDP / EDT / Oil" value={form.concentration} onChange={(e) => set('concentration', e.target.value)} />
              <Input name="scentFamily" label="Scent family" placeholder="Oud, fresh, woody…" value={form.scentFamily} onChange={(e) => set('scentFamily', e.target.value)} />
              <Input name="notesTop" label="Top notes" placeholder="Bergamot, saffron" value={form.notesTop} onChange={(e) => set('notesTop', e.target.value)} />
              <Input name="notesHeart" label="Heart notes" value={form.notesHeart} onChange={(e) => set('notesHeart', e.target.value)} />
              <Input name="notesBase" label="Base notes" value={form.notesBase} onChange={(e) => set('notesBase', e.target.value)} />
            </>
          )}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Textarea name="descriptionEn" label="Description (English)" rows={3} value={form.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} />
          <Textarea name="descriptionAm" label="Description (Amharic)" rows={3} value={form.descriptionAm} onChange={(e) => set('descriptionAm', e.target.value)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Input name="badge" label="Badge" placeholder="New, −20%…" value={form.badge} onChange={(e) => set('badge', e.target.value)} />
          <Input name="tags" label="Search words" placeholder="wedding, office" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          <Input name="tikTokUrl" label="TikTok video link" value={form.tikTokUrl} onChange={(e) => set('tikTokUrl', e.target.value)} />
        </div>
      </Card>

      {product && <StockGrid key={`${product.id}-${category?.id}`} product={product} category={category} onChange={setProduct} />}
      {product && <Announce product={product} />}
      {product && <Publish product={product} />}

      {product && (
        <div className="flex justify-end">
          <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => window.confirm('Delete this product?') && remove.mutate()}>
            <Trash2 className="size-4" /> Delete product
          </Button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-seam bg-ink/90 px-4 py-3 backdrop-blur md:left-[240px]">
        <div className="mx-auto flex max-w-4xl justify-end">
          <Button variant="accent" loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
            {isNew ? 'Create product' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
