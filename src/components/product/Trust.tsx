/**
 * Product-page trust pieces: size helper, "Original" proof, TikTok video, reviews.
 * Everything heavy (video player, proof photos, review list) loads only when needed.
 */
import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Camera, Play, Ruler, Star, X } from 'lucide-react';
import { Button, Img, Sheet } from '../ui';
import { toast } from '../ui/toast';
import { api, ApiError } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/format';
import { haptic, openExternal } from '../../lib/telegram';
import { sizeScheme, suggestSize } from '../../lib/sizeAdvisor';
import type { Category, Product, Review, ReviewSummary } from '../../lib/types';
import { useSizes, useSizeProfile } from '../../store/sizes';

// ─── Stars ───────────────────────────────────────────────

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-3.5', i <= Math.round(value) ? 'fill-camel text-camel' : 'text-seam')} />
      ))}
    </span>
  );
}

// ─── Size helper ─────────────────────────────────────────

export function canSuggestSize(category: Category) {
  return sizeScheme(category) !== null;
}

export function SizeHelper({
  category,
  open,
  onClose,
  onPick,
  isAvailable,
}: {
  category: Category;
  open: boolean;
  onClose: () => void;
  onPick: (size: string) => void;
  isAvailable: (size: string) => boolean;
}) {
  const { t } = useT();
  const profile = useSizeProfile();
  const setBody = useSizes((s) => s.setBody);
  const [height, setHeight] = useState(profile.height ? String(profile.height) : '');
  const [weight, setWeight] = useState(profile.weight ? String(profile.weight) : '');
  const [fit, setFit] = useState<'slim' | 'regular' | 'loose'>(profile.fit ?? 'regular');
  const h = Number(height);
  const w = Number(weight);
  const valid = h >= 140 && h <= 220 && w >= 40 && w <= 200;
  const suggestion = valid ? suggestSize(category, { height: h, weight: w, fit }) : null;
  const available = suggestion ? isAvailable(suggestion) : false;

  return (
    <Sheet open={open} onClose={onClose} title={t('size.title')}>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['height', t('size.height'), height, setHeight, '175'],
            ['weight', t('size.weight'), weight, setWeight, '75'],
          ] as const
        ).map(([key, label, value, set, ph]) => (
          <label key={key} className="block">
            <span className="mb-1.5 block text-[0.8rem] text-steel">{label}</span>
            <input
              inputMode="numeric"
              value={value}
              placeholder={ph}
              onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 3))}
              className="h-14 w-full rounded-xl border border-seam bg-ink/40 px-4 text-center font-mono text-xl focus:border-camel focus:outline-none"
            />
          </label>
        ))}
      </div>
      <p className="mb-2 mt-5 text-[0.8rem] text-steel">{t('size.fit')}</p>
      <div className="grid grid-cols-3 gap-2">
        {(['slim', 'regular', 'loose'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFit(f)}
            className={cn('h-11 rounded-xl border text-sm transition-colors', fit === f ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel hover:text-chalk')}
          >
            {t(`size.${f}`)}
          </button>
        ))}
      </div>

      <div className={cn('mt-6 rounded-2xl border p-5 text-center transition-colors', suggestion ? 'border-camel/50 bg-camel/[0.07]' : 'border-seam/70')}>
        {suggestion ? (
          <>
            <p className="label">{t('size.suggest')}</p>
            <p className="display mt-1 font-mono text-5xl">{suggestion}</p>
            {!available && <p className="mt-2 text-xs text-camel">{t('size.unavailable', { size: suggestion })}</p>}
          </>
        ) : (
          <Ruler className="mx-auto size-8 text-seam" />
        )}
      </div>
      <Button
        variant="accent"
        size="lg"
        block
        className="mt-4"
        disabled={!suggestion}
        onClick={() => {
          setBody({ height: h, weight: w, fit });
          onPick(suggestion!);
          haptic.success();
          onClose();
        }}
      >
        {suggestion ? t('size.use', { size: suggestion }) : t('size.findMine')}
      </Button>
      <p className="mt-4 text-center text-xs leading-relaxed text-steel">{t('size.note')}</p>
    </Sheet>
  );
}

// ─── Original proof ──────────────────────────────────────

export function OriginalBadge({ product }: { product: Product }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  if (!product.proofs.length) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-camel/40 bg-camel/[0.08] px-3 py-1.5 text-xs font-medium text-chalk transition-colors hover:border-camel"
      >
        <BadgeCheck className="size-4 text-camel" /> {t('orig.badge')}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('orig.title')}>
        <p className="text-sm text-steel">{t('orig.text')}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {product.proofs.map((p) => (
            <button key={p.id} onClick={() => setZoom(p.urls.lg)} className="relative overflow-hidden rounded-xl">
              <Img urls={p.urls} alt="" className="aspect-square w-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2.5 py-1 text-[0.7rem] backdrop-blur">{t(`orig.${p.label}`)}</span>
            </button>
          ))}
        </div>
      </Sheet>
      {zoom && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button className="absolute right-4 top-4 rounded-full bg-ink/80 p-2" aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}

// ─── TikTok video ────────────────────────────────────────

export function VideoTile({ product }: { product: Product }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!product.tikTokUrl) return null;
  const cover = product.images[1] ?? product.images[0];
  const play = () => (product.tikTokVideoId ? setOpen(true) : openExternal(product.tikTokUrl!));
  return (
    <>
      <button onClick={play} className="group mt-6 flex w-full items-center gap-4 rounded-2xl border border-seam p-2 pr-4 text-left transition-colors hover:border-steel">
        <span className="relative block aspect-[9/12] w-16 shrink-0 overflow-hidden rounded-xl bg-wool">
          {cover && <Img urls={cover.urls} alt="" className="size-full object-cover opacity-80" />}
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-8 place-items-center rounded-full bg-chalk/90 text-ink transition-transform group-hover:scale-110">
              <Play className="ml-0.5 size-4 fill-ink" />
            </span>
          </span>
        </span>
        <span>
          <span className="block text-sm font-medium">{t('video.watch')}</span>
          <span className="mt-0.5 block text-xs text-steel">{t('video.sub')}</span>
        </span>
      </button>
      {open && product.tikTokVideoId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setOpen(false)}>
          <div className="relative aspect-[9/16] h-full max-h-[88dvh] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <iframe
              title="TikTok"
              src={`https://www.tiktok.com/player/v1/${product.tikTokVideoId}?autoplay=1&loop=1&music_info=0&description=0&rel=0&native_context_menu=0`}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              className="size-full"
            />
          </div>
          <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full bg-ink/80 p-2" aria-label={t('common.close')}>
            <X className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Reviews ─────────────────────────────────────────────

interface ReviewPage {
  summary: ReviewSummary;
  reviews: Review[];
  hasMore: boolean;
}

export function RatingLink({ product }: { product: Product }) {
  const { t } = useT();
  if (!product.rating) return null;
  return (
    <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-steel hover:text-chalk">
      <Stars value={product.rating.average} />
      <span className="font-mono text-chalk">{product.rating.average.toFixed(1)}</span>
      <span>· {product.rating.count === 1 ? t('rev.one') : t('rev.count', { n: product.rating.count })}</span>
    </a>
  );
}

export function Reviews({ product }: { product: Product }) {
  const { t } = useT();
  const [zoom, setZoom] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: ['reviews', product.slug],
    queryFn: ({ pageParam }) => api<ReviewPage>('/reviews', { query: { product: product.slug, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    enabled: Boolean(product.rating),
  });
  if (!product.rating) return null;
  const summary = q.data?.pages[0]?.summary;
  const reviews = q.data?.pages.flatMap((p) => p.reviews) ?? [];
  const photos = reviews.flatMap((r) => r.photos);

  return (
    <section id="reviews" className="mt-16 scroll-mt-24 px-4 md:px-0">
      <h2 className="display mb-6 text-[1.35rem]">{t('rev.title')}</h2>
      {summary && (
        <div className="grid gap-8 md:grid-cols-[260px_1fr]">
          <div>
            <p className="display font-mono text-5xl">{summary.average?.toFixed(1)}</p>
            <Stars value={summary.average ?? 0} className="mt-2" />
            <p className="mt-1 text-sm text-steel">{summary.count === 1 ? t('rev.one') : t('rev.count', { n: summary.count })}</p>
            <div className="mt-4 space-y-1.5">
              {summary.distribution.map((n, i) => (
                <div key={i} className="flex items-center gap-2 font-mono text-xs text-steel">
                  <span className="w-3">{5 - i}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-seam">
                    <span className="block h-full rounded-full bg-camel" style={{ width: `${summary.count ? (n / summary.count) * 100 : 0}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            {photos.length > 0 && (
              <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
                {photos.map((p) => (
                  <button key={p.id} onClick={() => setZoom(p.urls.lg)} className="shrink-0 overflow-hidden rounded-xl">
                    <Img urls={p.urls} alt="" className="size-24 object-cover" />
                  </button>
                ))}
              </div>
            )}
            <ul className="divide-y divide-seam/70">
              {reviews.map((r) => (
                <li key={r.id} className="py-5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    <span className="text-sm">{r.name}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-ok">
                      <BadgeCheck className="size-3.5" /> {t('rev.verified')}
                    </span>
                    {r.size && <span className="font-mono text-xs text-steel">{t('rev.bought', { size: r.size })}</span>}
                  </div>
                  {r.text && <p className="mt-2 whitespace-pre-line text-[0.95rem] leading-relaxed text-chalk/85">{r.text}</p>}
                  {r.photos.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {r.photos.map((p) => (
                        <button key={p.id} onClick={() => setZoom(p.urls.lg)} className="overflow-hidden rounded-lg">
                          <Img urls={p.urls} alt="" className="size-16 object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {q.hasNextPage && (
              <Button variant="outline" size="sm" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                {t('rev.more')}
              </Button>
            )}
          </div>
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </section>
  );
}

// ─── Write a review ──────────────────────────────────────

export interface ReviewTarget {
  productId: string;
  slug: string;
  nameEn: string;
  nameAm: string | null;
  size: string;
  image: string | null;
  orderNumber: string;
}

export function WriteReview({ item, onClose, onDone }: { item: ReviewTarget; onClose: () => void; onDone: () => void }) {
  const { t, pick } = useT();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set('productId', item.productId);
      form.set('rating', String(rating));
      if (text.trim()) form.set('text', text.trim());
      files.forEach((f) => form.append('photos', f.file));
      await api('/reviews', { form });
      haptic.success();
      toast.ok(t('rev.thanks'));
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('common.loadError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('rev.writeOne')}
      footer={
        <Button variant="accent" size="lg" block disabled={!rating} loading={busy} onClick={send}>
          {t('rev.send')}
        </Button>
      }
    >
      <div className="flex items-center gap-3">
        {item.image && <img src={item.image} alt="" className="aspect-[4/5] w-12 rounded-md object-cover" />}
        <div>
          <p className="text-sm">{pick(item.nameEn, item.nameAm)}</p>
          {item.size && <p className="font-mono text-xs text-steel">{item.size}</p>}
        </div>
      </div>
      <div className="mt-6 flex justify-center gap-2" role="radiogroup" aria-label={t('rev.stars')}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            role="radio"
            aria-checked={rating === i}
            onClick={() => {
              setRating(i);
              haptic.select();
            }}
            className="p-1 transition-transform active:scale-90"
          >
            <Star className={cn('size-10', i <= rating ? 'fill-camel text-camel' : 'text-seam')} strokeWidth={1.4} />
          </button>
        ))}
      </div>
      {!rating && <p className="mt-1 text-center text-xs text-steel">{t('rev.stars')}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        placeholder={t('rev.placeholder')}
        rows={4}
        className="mt-6 w-full rounded-xl border border-seam bg-ink/40 px-4 py-3 text-chalk placeholder:text-steel/60 focus:border-camel focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {files.map((f) => (
          <span key={f.url} className="relative">
            <img src={f.url} alt="" className="size-16 rounded-lg object-cover" />
            <button
              onClick={() => setFiles((all) => all.filter((x) => x !== f))}
              className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-chalk ring-1 ring-seam"
              aria-label={t('common.close')}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {files.length < 4 && (
          <label className="flex size-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-seam text-[0.65rem] text-steel hover:border-camel">
            <Camera className="size-5" />
            {t('rev.addPhotos')}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = [...(e.target.files ?? [])].map((file) => ({ file, url: URL.createObjectURL(file) }));
                setFiles((all) => [...all, ...picked].slice(0, 4));
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
    </Sheet>
  );
}

/** "Rate your purchase" — received items the customer hasn't reviewed yet. */
export function RatePurchases({ orderNumber, autoOpen, className }: { orderNumber?: string; autoOpen?: boolean; className?: string }) {
  const { t, pick } = useT();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['to-review'],
    queryFn: () => api<{ items: ReviewTarget[] }>('/reviews/to-write').then((r) => r.items),
  });
  const items = (q.data ?? []).filter((i) => !orderNumber || i.orderNumber === orderNumber);
  const [open, setOpen] = useState<ReviewTarget | null>(null);
  const [autoDone, setAutoDone] = useState(false);
  useEffect(() => {
    if (autoOpen && !autoDone && items[0]) {
      setAutoDone(true);
      setOpen(items[0]);
    }
  }, [autoOpen, autoDone, items]);
  if (!items.length) return null;
  return (
    <div className={cn('rounded-2xl border border-camel/30 bg-camel/[0.05] p-4', className)}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Star className="size-4 fill-camel text-camel" /> {t('rev.write')}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.productId} className="flex items-center gap-3">
            {i.image ? <img src={i.image} alt="" className="aspect-[4/5] w-10 rounded-md object-cover" /> : <span className="aspect-[4/5] w-10 rounded-md bg-wool" />}
            <span className="min-w-0 flex-1 truncate text-sm">{pick(i.nameEn, i.nameAm)}</span>
            <Button size="sm" variant="primary" onClick={() => setOpen(i)}>
              {t('rev.writeOne')}
            </Button>
          </li>
        ))}
      </ul>
      {open && (
        <WriteReview
          item={open}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            void qc.invalidateQueries({ queryKey: ['to-review'] });
            void qc.invalidateQueries({ queryKey: ['reviews'] });
            void qc.invalidateQueries({ queryKey: ['product'] });
          }}
        />
      )}
    </div>
  );
}
