import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, Camera, Check, ChevronDown, ExternalLink, Megaphone, Minus, Plus, Send, Trash2, X } from 'lucide-react';
import { Button, ErrorState, Input, PageLoader, Textarea } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, sortSizes } from '../../lib/format';
import type { Category } from '../../lib/types';
import type { AdminProduct } from '../types';
import { suggestAmharicDescription, suggestAmharicName } from '../../lib/amharic';
import { adminApi, Card, Toggle } from '../ui';

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const int = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\D/g, '')));
const digits = (s: string, max = 9) => s.replace(/\D/g, '').slice(0, max);
const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong');

type Status = AdminProduct['status'];

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
  preorder: boolean;
  preorderNote: string;
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
  preorder: false,
  preorderNote: '',
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
    preorder: p.preorder ?? false,
    preorderNote: p.preorderNote ?? '',
  };
}

function toPayload(f: Form, status: Status) {
  return {
    nameEn: f.nameEn.trim(),
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
    status,
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
    preorder: f.preorder,
    preorderNote: f.preorder ? f.preorderNote || null : null,
  };
}

// ─── Stock state (sizes × colours) ───────────────────────

interface Colour {
  name: string;
  hex: string;
}
interface StockState {
  sizes: string[];
  colors: Colour[];
  qty: Record<string, string>; // `${size}|${colour}` → quantity
}
const k = (size: string, color: string) => `${size}|${color}`;

function stockFrom(p?: AdminProduct): StockState {
  if (!p) return { sizes: [], colors: [], qty: {} };
  const active = p.variants.filter((v) => v.isActive);
  const sizes = sortSizes([...new Set(active.map((v) => v.size).filter(Boolean))]);
  const colorMap = new Map<string, string>();
  active.forEach((v) => v.color && !colorMap.has(v.color) && colorMap.set(v.color, v.colorHex ?? '#888888'));
  const qty: Record<string, string> = {};
  active.forEach((v) => (qty[k(v.size, v.color)] = String(v.stock)));
  return { sizes, colors: [...colorMap].map(([name, hex]) => ({ name, hex })), qty };
}

/** The rows/columns actually saved: no sizes → one "" size, no colours → one "" colour. */
function grid(s: StockState, sized: boolean) {
  return { sizes: sized ? s.sizes : [''], colors: s.colors.length ? s.colors : [{ name: '', hex: '' }] };
}
function totalOf(s: StockState, sized: boolean) {
  const g = grid(s, sized);
  return g.sizes.reduce((n, size) => n + g.colors.reduce((m, c) => m + Number(s.qty[k(size, c.name)] || 0), 0), 0);
}
function variantsOf(s: StockState, sized: boolean, product?: AdminProduct) {
  const g = grid(s, sized);
  const existing = new Map(product?.variants.map((v) => [k(v.size, v.color), v]) ?? []);
  return g.sizes.flatMap((size) =>
    g.colors.map((c) => ({
      size,
      color: c.name,
      colorHex: c.hex || null,
      price: existing.get(k(size, c.name))?.price ?? null,
      stock: Number(s.qty[k(size, c.name)] || 0),
      isActive: true,
    })),
  );
}

function Stepper({ value, onChange, label, big }: { value: string; onChange: (v: string) => void; label: string; big?: boolean }) {
  const n = Number(value || 0);
  return (
    <div className={cn('inline-flex items-center rounded-full border border-seam bg-ink/60', big ? 'h-14' : 'h-11')}>
      <button
        type="button"
        onClick={() => onChange(String(Math.max(0, n - 1)))}
        disabled={n <= 0}
        className={cn('grid h-full place-items-center text-steel transition-colors hover:text-chalk disabled:opacity-30', big ? 'w-14' : 'w-11')}
        aria-label={`Fewer ${label}`}
      >
        <Minus className="size-4" />
      </button>
      <input
        value={value}
        onChange={(e) => onChange(digits(e.target.value, 5))}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        placeholder="0"
        aria-label={`Quantity ${label}`}
        className={cn('h-full bg-transparent text-center font-mono focus:outline-none', big ? 'w-16 text-xl' : 'w-10 text-base', n === 0 && 'text-steel')}
      />
      <button
        type="button"
        onClick={() => onChange(String(n + 1))}
        className={cn('grid h-full place-items-center text-camel transition-colors hover:text-chalk', big ? 'w-14' : 'w-11')}
        aria-label={`More ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function StockSection({
  state,
  setState,
  category,
  waiting,
  missing,
}: {
  state: StockState;
  setState: (fn: (s: StockState) => StockState) => void;
  category?: Category;
  waiting: { label: string; count: number }[];
  missing: boolean;
}) {
  const sized = (category?.sizes.length ?? 0) > 0 || state.sizes.length > 0;
  const [custom, setCustom] = useState('');
  const [newColor, setNewColor] = useState<Colour>({ name: '', hex: '#1a1a1a' });
  const [showColours, setShowColours] = useState(state.colors.length > 0);
  const available = sortSizes([...new Set([...(category?.sizes ?? []), ...state.sizes])]);
  const g = grid(state, sized);
  const total = totalOf(state, sized);
  const multi = state.colors.length > 0;

  const setQty = (key: string, v: string) => setState((s) => ({ ...s, qty: { ...s.qty, [key]: v } }));
  const toggleSize = (size: string) =>
    setState((s) => {
      if (s.sizes.includes(size)) return { ...s, sizes: s.sizes.filter((x) => x !== size) };
      // Picking a size means she has it: start at 1 so nothing is forgotten at 0
      const qty = { ...s.qty };
      (s.colors.length ? s.colors : [{ name: '' }]).forEach((c) => {
        if (!Number(qty[k(size, c.name)] || 0)) qty[k(size, c.name)] = '1';
      });
      return { ...s, sizes: sortSizes([...s.sizes, size]), qty };
    });
  const addColour = () => {
    const name = newColor.name.trim();
    if (!name || state.colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    setState((s) => {
      // The first colour takes over the quantities entered without a colour
      const qty = { ...s.qty };
      if (!s.colors.length) (sized ? s.sizes : ['']).forEach((size) => (qty[k(size, name)] = qty[k(size, '')] ?? ''));
      return { ...s, colors: [...s.colors, { name, hex: newColor.hex }], qty };
    });
    setNewColor({ name: '', hex: '#1a1a1a' });
  };

  return (
    <Card
      title={sized ? 'Sizes & quantity' : 'Quantity'}
      action={
        <span className={cn('font-mono text-xs', total ? 'text-camel' : 'text-steel')}>
          {total} {total === 1 ? 'piece' : 'pieces'}
        </span>
      }
      className={cn(missing && '!border-danger/60')}
    >
      {sized && (
        <>
          <p className="mb-3 text-sm text-steel">Tap the sizes you have.</p>
          <div className="flex flex-wrap gap-2">
            {available.map((s) => {
              const on = state.sizes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={cn(
                    'h-11 min-w-12 rounded-xl border px-3 font-mono text-sm transition-colors',
                    on ? 'border-camel bg-camel text-ink' : 'border-seam text-steel hover:border-steel hover:text-chalk',
                  )}
                >
                  {s}
                </button>
              );
            })}
            <span className="flex h-11">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value.toUpperCase().slice(0, 8))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && custom.trim()) {
                    toggleSize(custom.trim());
                    setCustom('');
                  }
                }}
                placeholder="Other"
                aria-label="Other size"
                className="w-20 rounded-l-xl border border-seam bg-ink px-3 font-mono text-sm focus:border-camel focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (custom.trim()) toggleSize(custom.trim());
                  setCustom('');
                }}
                className="rounded-r-xl border border-l-0 border-seam px-3 text-steel hover:text-chalk"
                aria-label="Add size"
              >
                <Plus className="size-4" />
              </button>
            </span>
          </div>
        </>
      )}

      {/* One colour: a quantity stepper per size (or a single one) */}
      {!multi && (!sized || state.sizes.length > 0) && (
        <div className={cn(sized && 'mt-5 grid gap-2 sm:grid-cols-2')}>
          {sized ? (
            state.sizes.map((s) => (
              <div key={s} className="flex items-center justify-between rounded-xl border border-seam/70 bg-ink/30 py-1.5 pl-4 pr-1.5">
                <span className="font-mono text-base">{s}</span>
                <Stepper label={s} value={state.qty[k(s, '')] ?? ''} onChange={(v) => setQty(k(s, ''), v)} />
              </div>
            ))
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-steel">How many do you have?</p>
              <Stepper big label="in stock" value={state.qty[k('', '')] ?? ''} onChange={(v) => setQty(k('', ''), v)} />
            </div>
          )}
        </div>
      )}

      {/* Several colours: a small size × colour grid */}
      {multi && (!sized || state.sizes.length > 0) && (
        <div className="mt-5 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th />
                {g.sizes.map((s) => (
                  <th key={s} className="px-1 pb-2 font-mono text-xs font-normal text-steel">
                    {s || 'Qty'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.colors.map((c) => (
                <tr key={c.name}>
                  <td className="py-1 pr-3">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="size-4 rounded-full ring-1 ring-inset ring-white/15" style={{ background: c.hex }} />
                      {c.name}
                    </span>
                  </td>
                  {g.sizes.map((s) => (
                    <td key={s} className="px-1 py-1">
                      <input
                        value={state.qty[k(s, c.name)] ?? ''}
                        onChange={(e) => setQty(k(s, c.name), digits(e.target.value, 5))}
                        onFocus={(e) => e.target.select()}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`Quantity ${s} ${c.name}`}
                        className="h-11 w-14 rounded-lg border border-seam bg-ink text-center font-mono focus:border-camel focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Colours are optional and tucked away */}
      <div className="mt-5 border-t border-seam/60 pt-4">
        {!showColours ? (
          <button type="button" onClick={() => setShowColours(true)} className="text-sm text-steel hover:text-chalk">
            + Several colours?
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {state.colors.map((c) => (
              <span key={c.name} className="flex h-9 items-center gap-2 rounded-full border border-seam pl-1.5 pr-1 text-sm">
                <span className="size-6 rounded-full ring-1 ring-inset ring-white/15" style={{ background: c.hex }} />
                {c.name}
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, colors: s.colors.filter((x) => x.name !== c.name) }))}
                  className="grid size-6 place-items-center rounded-full text-steel hover:text-danger"
                  aria-label={`Remove ${c.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <span className="flex items-center gap-1">
              <input
                type="color"
                value={newColor.hex}
                onChange={(e) => setNewColor((n) => ({ ...n, hex: e.target.value }))}
                className="size-9 rounded-md border border-seam bg-ink"
                aria-label="Colour"
              />
              <input
                value={newColor.name}
                onChange={(e) => setNewColor((n) => ({ ...n, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addColour()}
                placeholder="e.g. Navy"
                className="h-9 w-28 rounded-md border border-seam bg-ink px-2 text-sm focus:border-camel focus:outline-none"
              />
              <Button variant="outline" size="sm" onClick={addColour} disabled={!newColor.name.trim()}>
                Add
              </Button>
            </span>
          </div>
        )}
      </div>

      {waiting.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-camel/[0.08] px-3 py-2.5 text-sm">
          <Bell className="mt-0.5 size-4 shrink-0 text-camel" />
          <span>
            {waiting.reduce((n, w) => n + w.count, 0)} waiting for <b>{waiting.map((w) => `${w.label} (${w.count})`).join(', ')}</b> — they get a
            Telegram message when you add stock and save.
          </span>
        </p>
      )}
    </Card>
  );
}

// ─── Photos ──────────────────────────────────────────────

interface Pending {
  file: File;
  url: string;
}

function PhotoTile({ src, cover, onRemove, onCover, children }: { src: string; cover: boolean; onRemove: () => void; onCover: () => void; children?: React.ReactNode }) {
  return (
    <div className={cn('group relative', cover && 'col-span-2 row-span-2')}>
      <button type="button" onClick={onCover} disabled={cover} className="block w-full" title={cover ? 'Cover photo' : 'Make this the cover'}>
        <img src={src} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
      </button>
      {cover && <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-[0.7rem] font-medium backdrop-blur">Cover</span>}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-ink/80 text-chalk backdrop-blur hover:text-danger"
        aria-label="Remove photo"
      >
        <X className="size-4" />
      </button>
      {children}
    </div>
  );
}

function AddPhotos({ onFiles, busy, first, missing }: { onFiles: (f: File[]) => void; busy: boolean; first: boolean; missing: boolean }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-steel transition-colors hover:border-camel hover:text-chalk',
        first ? 'col-span-full h-44 sm:h-48' : 'aspect-[4/5]',
        missing ? 'border-danger/60' : 'border-seam',
        busy && 'pointer-events-none opacity-50',
      )}
    >
      <Camera className={first ? 'size-8 text-camel' : 'size-6'} />
      <span className={first ? 'text-base text-chalk' : 'text-xs'}>{busy ? 'Uploading…' : first ? 'Add photos' : 'Add'}</span>
      {first && <span className="text-xs">The first one is the cover</span>}
      <input
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/** Photos of a product that already exists: changes are saved straight away. */
function SavedPhotos({ product, onChange, missing }: { product: AdminProduct; onChange: (p: AdminProduct) => void; missing: boolean }) {
  const [busy, setBusy] = useState(false);
  const colors = [...new Set(product.variants.filter((v) => v.isActive).map((v) => v.color).filter(Boolean))];
  const run = async (fn: () => Promise<{ product: AdminProduct }>) => {
    try {
      onChange((await fn()).product);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    for (let i = 0; i < files.length; i += 4) {
      const form = new FormData();
      files.slice(i, i + 4).forEach((f) => form.append('images', f));
      await run(() => adminApi(`/products/${product.id}/images`, { form }));
    }
    setBusy(false);
  };
  const makeCover = (id: string) =>
    run(() => adminApi(`/products/${product.id}/images/order`, { method: 'PUT', body: { imageIds: [id, ...product.images.map((i) => i.id).filter((x) => x !== id)] } }));
  const remove = (id: string) => window.confirm('Delete this photo?') && run(() => adminApi(`/products/${product.id}/images/${id}`, { method: 'DELETE' }));
  const setColor = (id: string, color: string) => run(() => adminApi(`/products/${product.id}/images/${id}`, { method: 'PATCH', body: { color: color || null } }));

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
      {product.images.map((img, i) => (
        <PhotoTile key={img.id} src={img.urls.sm} cover={i === 0} onRemove={() => remove(img.id)} onCover={() => makeCover(img.id)}>
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
        </PhotoTile>
      ))}
      <AddPhotos onFiles={upload} busy={busy} first={!product.images.length} missing={missing} />
    </div>
  );
}

/** Photos of a product being created: kept in the browser and uploaded on save. */
function PendingPhotos({ photos, setPhotos, missing }: { photos: Pending[]; setPhotos: (fn: (p: Pending[]) => Pending[]) => void; missing: boolean }) {
  const add = (files: File[]) =>
    setPhotos((p) => [...p, ...files.filter((f) => f.type.startsWith('image/')).map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 12));
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
      {photos.map((p, i) => (
        <PhotoTile
          key={p.url}
          src={p.url}
          cover={i === 0}
          onRemove={() =>
            setPhotos((all) => {
              URL.revokeObjectURL(p.url);
              return all.filter((x) => x !== p);
            })
          }
          onCover={() => setPhotos((all) => [p, ...all.filter((x) => x !== p)])}
        />
      ))}
      {photos.length < 12 && <AddPhotos onFiles={add} busy={false} first={!photos.length} missing={missing} />}
    </div>
  );
}

// ─── "Original" proof photos ─────────────────────────────

const PROOF_SLOTS = [
  { label: 'box', title: 'Box' },
  { label: 'tag', title: 'Tags' },
  { label: 'receipt', title: 'Receipt' },
  { label: 'other', title: 'Other' },
] as const;

function ProofPhotos({ product, onChange }: { product: AdminProduct; onChange: (p: AdminProduct) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const upload = async (label: string, files: File[]) => {
    if (!files.length) return;
    setBusy(label);
    try {
      const form = new FormData();
      form.set('label', label);
      files.slice(0, 4).forEach((f) => form.append('images', f));
      onChange((await adminApi<{ product: AdminProduct }>(`/products/${product.id}/proofs`, { form })).product);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
    }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Delete this photo?')) return;
    try {
      onChange((await adminApi<{ product: AdminProduct }>(`/products/${product.id}/proofs/${id}`, { method: 'DELETE' })).product);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  const on = product.proofs.length > 0;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">Proof it’s original</p>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs', on ? 'bg-ok/15 text-ok' : 'bg-seam text-steel')}>
          <Check className="size-3.5" /> {on ? '“Original” badge is showing' : 'Add a photo to show the “Original” badge'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {PROOF_SLOTS.map((slot) => {
          const photos = product.proofs.filter((p) => p.label === slot.label);
          return (
            <div key={slot.label} className="space-y-2">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  <img src={p.urls.sm} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  <button
                    onClick={() => remove(p.id)}
                    className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-ink/80 hover:text-danger"
                    aria-label="Remove photo"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <label
                className={cn(
                  'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-seam text-xs text-steel hover:border-camel hover:text-chalk',
                  busy === slot.label && 'pointer-events-none opacity-50',
                )}
              >
                <Camera className="size-5" />
                {busy === slot.label ? '…' : slot.title}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    void upload(slot.label, [...(e.target.files ?? [])]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sharing (on-sale products only) ─────────────────────

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
      toast.error(errMsg(err));
    },
  });
  const d = info.data;
  const last = d?.last;
  return (
    <Card title="Tell customers">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-steel">
          <Bell className="mr-1.5 inline size-4 text-camel" />
          {d ? `${d.subscribers} subscriber${d.subscribers === 1 ? '' : 's'} on Telegram` : '…'}
        </p>
        <Button variant="primary" loading={send.isPending} disabled={!d?.subscribers || last?.status === 'sending'} onClick={() => send.mutate(false)}>
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
      {d && !d.subscribers && <p className="mt-2 text-xs text-steel">Customers subscribe with the bot’s “🔔 New arrivals” button, /news, or on the website.</p>}
    </Card>
  );
}

function Publish({ product }: { product: AdminProduct }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
    onError: (err) => toast.error(errMsg(err)),
  });

  return (
    <Card
      title="Telegram channel"
      action={
        product.telegramPostUrl ? (
          <a href={product.telegramPostUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-camel">
            Last post <ExternalLink className="size-3" />
          </a>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-sm text-steel hover:text-chalk">
          {open ? 'Hide text' : 'Edit post text'} <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </button>
        <Button variant="primary" loading={publish.isPending} onClick={() => publish.mutate()}>
          <Send className="size-4" /> Post to channel
        </Button>
      </div>
      {open && <Textarea name="caption" rows={12} value={text} onChange={(e) => setText(e.target.value)} className="mt-4 font-mono text-[0.8rem] leading-relaxed" />}
    </Card>
  );
}

// ─── Editor ──────────────────────────────────────────────

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2 text-[0.8rem] text-steel">{label}</p>
      {children}
    </div>
  );
}

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(empty);
  const [stock, setStockRaw] = useState<StockState>(() => stockFrom());
  const [stockDirty, setStockDirty] = useState(false);
  const [photos, setPhotos] = useState<Pending[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'live' | 'hide'>(null);
  const [tried, setTried] = useState(false); // highlight what is missing after a failed "Put on sale"
  const loadedId = useRef<string | null>(null);

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

  // Fill the form once per product — background refetches never overwrite what she is typing
  useEffect(() => {
    if (product && loadedId.current !== product.id) {
      loadedId.current = product.id;
      setForm(toForm(product));
      setStockRaw(stockFrom(product));
      setStockDirty(false);
    }
  }, [product]);
  useEffect(() => {
    if (isNew && categories.data?.[0] && !form.categoryId) setForm((f) => ({ ...f, categoryId: categories.data[0]!.id }));
  }, [isNew, categories.data, form.categoryId]);
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const category = useMemo(() => categories.data?.find((c) => c.id === form.categoryId), [categories.data, form.categoryId]);
  const set = <K extends keyof Form>(key: K, v: Form[K]) => setForm((f) => ({ ...f, [key]: v }));
  const setStock = (fn: (s: StockState) => StockState) => {
    setStockRaw(fn);
    setStockDirty(true);
  };
  const setProduct = (p: AdminProduct) => {
    qc.setQueryData(['admin', 'product', p.id], p);
    void qc.invalidateQueries({ queryKey: ['admin', 'products'] });
  };

  const remove = useMutation({
    mutationFn: () => adminApi<{ archived?: boolean }>(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      toast.ok(r.archived ? 'Archived (it has orders)' : 'Deleted');
      void qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      navigate('/admin/products');
    },
    onError: (err) => toast.error(errMsg(err)),
  });

  if (!isNew && productQ.isLoading) return <PageLoader />;
  if (!isNew && (productQ.error || !product)) return <ErrorState message="Product not found." />;

  const status: Status = product?.status ?? 'DRAFT';
  const live = status === 'ACTIVE';
  const fragrance = category?.kind === 'FRAGRANCE';
  const sized = (category?.sizes.length ?? 0) > 0 || stock.sizes.length > 0;
  const total = totalOf(stock, sized);
  const photoCount = isNew ? photos.length : (product?.images.length ?? 0);
  const price = int(form.basePrice) ?? 0;

  const checks = [
    { ok: photoCount > 0, label: 'Photo' },
    { ok: form.nameEn.trim().length >= 2, label: 'Name' },
    { ok: price > 0, label: 'Price' },
    { ok: total > 0 || form.preorder, label: sized ? 'Size & quantity' : 'Quantity' },
  ];
  const missing = checks.filter((c) => !c.ok);
  const canSave = form.nameEn.trim().length >= 2 && Boolean(form.categoryId);
  const margin = price && int(form.costPrice) ? Math.round(((price - int(form.costPrice)!) / price) * 100) : null;
  const waiting = (product?.variants ?? [])
    .filter((v) => (v._count?.alerts ?? 0) > 0)
    .map((v) => ({ label: [v.size, v.color].filter(Boolean).join(' / ') || 'this item', count: v._count!.alerts }));
  const moreFilled = [form.compareAtPrice, form.costPrice, form.brandName, form.nameAm, form.origin, form.material, form.fit, form.descriptionEn, form.descriptionAm, form.badge, form.tags, form.volumeMl, form.concentration, form.scentFamily].filter(Boolean).length;

  /**
   * One save for everything. Going on sale happens last, after the photos and stock are in,
   * and the server double-checks both (a product can't go on sale empty).
   */
  const persist = async (target: Status, mode: 'save' | 'live' | 'hide') => {
    if (target === 'ACTIVE' && !live && missing.length) {
      setTried(true);
      toast.error(`Add ${missing.map((m) => m.label.toLowerCase()).join(', ')} first`);
      return;
    }
    setBusy(mode);
    let saved: AdminProduct | undefined;
    try {
      // Details (status only moves to ACTIVE in the final step)
      const firstStatus: Status = target === 'ACTIVE' && !live ? (isNew ? 'DRAFT' : status) : target;
      const body = toPayload(form, firstStatus);
      saved = (isNew
        ? await adminApi<{ product: AdminProduct }>('/products', { body })
        : await adminApi<{ product: AdminProduct }>(`/products/${product!.id}`, { method: 'PUT', body })
      ).product;

      // New photos (a few at a time — phone photos are big)
      if (isNew) {
        for (let i = 0; i < photos.length; i += 4) {
          const fd = new FormData();
          photos.slice(i, i + 4).forEach((p) => fd.append('images', p.file));
          saved = (await adminApi<{ product: AdminProduct }>(`/products/${saved.id}/images`, { form: fd })).product;
        }
      }
      // Stock — only when it was touched, so a sale made meanwhile is never overwritten
      if (isNew || stockDirty) {
        saved = (await adminApi<{ product: AdminProduct }>(`/products/${saved.id}/variants`, { method: 'PUT', body: { variants: variantsOf(stock, sized, saved) } })).product;
      }
      if (target === 'ACTIVE' && saved.status !== 'ACTIVE') {
        saved = (await adminApi<{ product: AdminProduct }>(`/products/${saved.id}/status`, { method: 'PATCH', body: { status: 'ACTIVE' } })).product;
      }

      setProduct(saved);
      setStockRaw(stockFrom(saved));
      setStockDirty(false);
      setTried(false);
      toast.ok(mode === 'live' ? 'On sale ✓' : mode === 'hide' ? 'Hidden from the shop' : isNew ? 'Saved as draft' : 'Saved');
      if (isNew) {
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        loadedId.current = saved.id;
        navigate(`/admin/products/${saved.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(errMsg(err));
      // A new product that was created but failed half-way: continue on its own page, nothing is lost
      if (isNew && saved) {
        setProduct(saved);
        navigate(`/admin/products/${saved.id}`, { replace: true });
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-32">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/products" className="inline-flex items-center gap-2 text-sm text-steel hover:text-chalk">
          <ArrowLeft className="size-4" /> Products
        </Link>
        {product && live && (
          <a href={`/p/${product.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-camel">
            View in shop <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display text-2xl">{isNew ? 'New product' : form.nameEn || 'Product'}</h1>
        {!isNew && (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs',
              live ? (total ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger') : 'bg-seam text-steel',
            )}
          >
            {live ? (total ? 'On sale' : 'On sale · sold out') : status === 'ARCHIVED' ? 'Archived' : 'Draft · hidden'}
          </span>
        )}
      </div>

      {/* 1 · Photos */}
      <Card title="Photos" action={photoCount > 1 ? <span className="text-xs text-steel">Tap a photo to make it the cover</span> : undefined} className={cn(tried && !photoCount && '!border-danger/60')}>
        {isNew ? (
          <PendingPhotos photos={photos} setPhotos={setPhotos} missing={tried && !photoCount} />
        ) : (
          <SavedPhotos product={product!} onChange={setProduct} missing={tried && !photoCount} />
        )}
      </Card>

      {/* 2 · Name, price, category */}
      <Card>
        <div className="space-y-5">
          <Input
            name="nameEn"
            label="Name"
            placeholder="e.g. Navy slim suit"
            value={form.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            error={tried && form.nameEn.trim().length < 2 ? 'Add a name' : undefined}
            className="h-14 text-lg"
          />
          <label className="block" htmlFor="basePrice">
            <span className="mb-1.5 block text-[0.8rem] text-steel">Price</span>
            <span className={cn('flex h-14 items-center rounded-xl border bg-wool px-4 focus-within:border-camel', tried && !price ? 'border-danger/60' : 'border-seam')}>
              <input
                id="basePrice"
                inputMode="numeric"
                placeholder="0"
                value={form.basePrice ? Number(form.basePrice).toLocaleString('en-US') : ''}
                onChange={(e) => set('basePrice', digits(e.target.value))}
                className="h-full min-w-0 flex-1 bg-transparent font-mono text-xl text-chalk placeholder:text-steel/50 focus:outline-none"
              />
              <span className="font-mono text-sm text-steel">ETB</span>
            </span>
          </label>
          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {(categories.data ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (c.id === form.categoryId) return;
                    set('categoryId', c.id);
                    // Sizes belong to the category: keep only the ones the new category also has
                    setStockRaw((s) => ({ ...s, sizes: s.sizes.filter((x) => c.sizes.includes(x)) }));
                    setStockDirty(true);
                  }}
                  className={cn(
                    'h-10 rounded-full border px-4 text-sm transition-colors',
                    form.categoryId === c.id ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel hover:border-steel hover:text-chalk',
                  )}
                >
                  {c.nameEn}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      {/* 3 · Sizes & quantity */}
      <StockSection
        key={`${product?.id ?? 'new'}-${category?.id ?? ''}`}
        state={stock}
        setState={setStock}
        category={category}
        waiting={waiting}
        missing={tried && total === 0}
      />

      {/* Pre-order: sell before it arrives */}
      <Card>
        <Toggle
          checked={form.preorder}
          onChange={(v) => set('preorder', v)}
          label="Pre-order"
          hint="Sell before it arrives — customers pay the deposit now (stock isn’t needed). Turn off when it arrives and add the stock."
        />
        {form.preorder && (
          <Input
            name="preorderNote"
            label="When does it arrive?"
            placeholder="e.g. Arrives from Turkey on 10 Dec"
            value={form.preorderNote}
            onChange={(e) => set('preorderNote', e.target.value.slice(0, 80))}
          />
        )}
      </Card>

      {/* 4 · Trust: TikTok video + "Original" proof */}
      <Card title="Video & proof">
        <Input
          name="tikTokUrl"
          label="TikTok video of this product"
          placeholder="Paste the link from TikTok → Share → Copy link"
          value={form.tikTokUrl}
          onChange={(e) => set('tikTokUrl', e.target.value.trim())}
          hint={form.tikTokUrl ? 'Customers can watch it on the product page (saved with the product).' : 'Optional — men trust your videos.'}
        />
        <div className="mt-6 border-t border-seam/60 pt-5">
          {product ? <ProofPhotos product={product} onChange={setProduct} /> : <p className="text-sm text-steel">Save the product first, then add photos of the box, tags and receipt to show the “Original” badge.</p>}
        </div>
      </Card>

      {/* 5 · Everything optional */}
      <Card flush>
        <button type="button" onClick={() => setMore((m) => !m)} className="flex w-full items-center justify-between px-5 py-4 text-left">
          <span>
            <span className="label !text-chalk/80">More details</span>
            <span className="ml-2 text-xs text-steel">{moreFilled ? `${moreFilled} filled` : 'optional'}</span>
          </span>
          <ChevronDown className={cn('size-5 text-steel transition-transform', more && 'rotate-180')} />
        </button>
        {more && (
          <div className="space-y-4 border-t border-seam/60 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="compareAtPrice"
                label="Old price (shown crossed out)"
                inputMode="numeric"
                value={form.compareAtPrice}
                onChange={(e) => set('compareAtPrice', digits(e.target.value))}
              />
              <Input
                name="costPrice"
                label="Your cost (private)"
                inputMode="numeric"
                value={form.costPrice}
                onChange={(e) => set('costPrice', digits(e.target.value))}
                hint={margin !== null ? `Margin ${margin}%` : 'For profit reports. Customers never see it.'}
              />
              <Input name="brand" label="Brand" placeholder="Skechers, Ibraq…" value={form.brandName} onChange={(e) => set('brandName', e.target.value)} />
              <div>
                <Input name="nameAm" label="Name in Amharic" value={form.nameAm} onChange={(e) => set('nameAm', e.target.value)} />
                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      nameAm: f.nameAm || suggestAmharicName(f.nameEn),
                      descriptionAm: f.descriptionAm || suggestAmharicDescription({ nameEn: f.nameEn, material: f.material, fit: f.fit, origin: f.origin }),
                    }));
                    toast.ok('Amharic suggested — check and edit it');
                  }}
                  disabled={form.nameEn.trim().length < 2}
                  className="mt-1.5 text-xs text-camel underline underline-offset-2 disabled:opacity-40"
                >
                  ✨ Suggest Amharic name & description
                </button>
              </div>
              <Input name="origin" label="Made in" placeholder="Turkey" value={form.origin} onChange={(e) => set('origin', e.target.value)} />
              {!fragrance && <Input name="material" label="Fabric" placeholder="100% cotton" value={form.material} onChange={(e) => set('material', e.target.value)} />}
              {!fragrance && <Input name="fit" label="Fit" placeholder="Slim / Regular" value={form.fit} onChange={(e) => set('fit', e.target.value)} />}
              {fragrance && (
                <>
                  <Input name="volumeMl" label="Volume (ml)" inputMode="numeric" value={form.volumeMl} onChange={(e) => set('volumeMl', digits(e.target.value, 4))} />
                  <Input name="concentration" label="Type" placeholder="EDP / EDT / Oil" value={form.concentration} onChange={(e) => set('concentration', e.target.value)} />
                  <Input name="scentFamily" label="Scent family" placeholder="Oud, fresh, woody…" value={form.scentFamily} onChange={(e) => set('scentFamily', e.target.value)} />
                  <Input name="notesTop" label="Top notes" placeholder="Bergamot, saffron" value={form.notesTop} onChange={(e) => set('notesTop', e.target.value)} />
                  <Input name="notesHeart" label="Heart notes" value={form.notesHeart} onChange={(e) => set('notesHeart', e.target.value)} />
                  <Input name="notesBase" label="Base notes" value={form.notesBase} onChange={(e) => set('notesBase', e.target.value)} />
                </>
              )}
            </div>
            <Textarea name="descriptionEn" label="Description" rows={3} value={form.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} />
            <Textarea name="descriptionAm" label="Description in Amharic" rows={3} value={form.descriptionAm} onChange={(e) => set('descriptionAm', e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="badge" label="Badge" placeholder="New, −20%…" value={form.badge} onChange={(e) => set('badge', e.target.value)} />
              <Input name="tags" label="Search words" placeholder="wedding, office" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Toggle checked={form.isNewArrival} onChange={(v) => set('isNewArrival', v)} label="New in" hint="Shown in the New in row" />
              <Toggle checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} label="Top pick" hint="Shown on the home page" />
            </div>
          </div>
        )}
      </Card>

      {/* 5 · Sharing, once it is on sale */}
      {product && live && (
        <div className="grid gap-5 md:grid-cols-2">
          <Publish product={product} />
          <Announce product={product} />
        </div>
      )}

      {product && (
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" loading={remove.isPending} onClick={() => window.confirm('Delete this product?') && remove.mutate()} className="text-danger">
            <Trash2 className="size-4" /> Delete product
          </Button>
        </div>
      )}

      {/* Sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-seam bg-ink/90 px-4 py-3 backdrop-blur md:left-[240px]">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-xs sm:flex">
            {!live &&
              checks.map((c) => (
                <span key={c.label} className={cn('inline-flex items-center gap-1', c.ok ? 'text-ok' : 'text-steel')}>
                  {c.ok ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-steel/60" />}
                  {c.label}
                </span>
              ))}
            {live && total === 0 && <span className="text-danger">Sold out — add quantity to sell again</span>}
          </div>
          <div className="ml-auto flex gap-2">
            {live ? (
              <>
                <Button variant="ghost" loading={busy === 'hide'} disabled={!canSave || !!busy} onClick={() => persist('DRAFT', 'hide')}>
                  Hide
                </Button>
                <Button variant="accent" loading={busy === 'save'} disabled={!canSave || !!busy} onClick={() => persist('ACTIVE', 'save')}>
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" loading={busy === 'save'} disabled={!canSave || !!busy} onClick={() => persist(isNew ? 'DRAFT' : status, 'save')}>
                  {isNew ? 'Save draft' : 'Save'}
                </Button>
                <Button variant="accent" loading={busy === 'live'} disabled={!!busy} onClick={() => persist('ACTIVE', 'live')}>
                  Put on sale
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
