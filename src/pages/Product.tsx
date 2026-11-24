import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { Check, ChevronRight, Send, Truck, X } from 'lucide-react';
import { Gallery } from '../components/product/Gallery';
import { ProductRail } from '../components/product/ProductCard';
import { TapeSizePicker } from '../components/product/TapeSizePicker';
import { PrimaryAction } from '../components/layout/PrimaryAction';
import { ErrorState, PageLoader, Price, Sheet } from '../components/ui';
import { toast } from '../components/ui/toast';
import { useConfig, useProduct, useProducts } from '../hooks/queries';
import { useT } from '../lib/i18n';
import { birr, cn, sortSizes } from '../lib/format';
import { haptic, openExternal, usesNativeButton } from '../lib/telegram';
import type { Product as P } from '../lib/types';
import { useCart } from '../store/cart';
import { useCustomer } from '../store/auth';
import { api, ApiError } from '../lib/api';
import { TelegramLogin } from '../components/layout/TelegramLogin';
import { canSuggestSize, OriginalBadge, RatingLink, Reviews, SizeHelper, VideoTile } from '../components/product/Trust';
import { useSizes, useSizeProfile } from '../store/sizes';
import { CompleteTheLook, salePrice, useOfferNotes, useSalePercent } from '../components/checkout/Offers';
import { HeartButton } from '../components/after/After';

function useSelection(product?: P) {
  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    product?.variants.forEach((v) => v.color && !map.has(v.color) && map.set(v.color, v.colorHex));
    return [...map].map(([name, hex]) => ({ name, hex }));
  }, [product]);
  const sizes = useMemo(() => sortSizes(product?.sizes ?? []), [product]);

  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const firstInStock = product.variants.find((v) => v.available > 0) ?? product.variants[0];
    setColor(firstInStock?.color || null);
    setSize(sizes.length === 1 ? sizes[0]! : null);
  }, [product, sizes]);

  const matches = (v: P['variants'][number], s: string | null, c: string | null) =>
    (sizes.length ? v.size === s : true) && (colors.length ? v.color === c : true);

  const variant = product?.variants.find((v) => matches(v, size, color));
  const isSizeAvailable = (s: string) => Boolean(product?.variants.some((v) => matches(v, s, color) && v.available > 0));
  const isColorAvailable = (c: string) => Boolean(product?.variants.some((v) => v.color === c && v.available > 0));

  return { colors, sizes, color, setColor, size, setSize, variant, isSizeAvailable, isColorAvailable };
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-6 border-b border-seam py-3 text-sm">
      <dt className="text-steel">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function SizeGuide({ product, open, onClose }: { product: P; open: boolean; onClose: () => void }) {
  const { t } = useT();
  const rows = product.category.sizeGuide ?? [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <Sheet open={open} onClose={onClose} title={t('product.sizeGuide')}>
      <p className="label mb-4">cm</p>
      <table className="w-full font-mono text-sm tabular-nums">
        <thead>
          <tr className="text-left text-steel">
            {cols.map((c) => (
              <th key={c} className="border-b border-seam pb-2 font-normal capitalize">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} className="border-b border-seam/60 py-2.5">
                  {r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { t, pick } = useT();
  const { data: product, isLoading, error, refetch } = useProduct(slug);
  const { data: config } = useConfig();
  const sel = useSelection(product);
  const add = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);
  const navigate = useNavigate();
  const [added, setAdded] = useState<{ image: string | null; name: string; detail: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);
  const sizeProfile = useSizeProfile();
  const rememberSize = useSizes((s) => s.rememberSize);
  const remembered = product ? sizeProfile.sizes[product.category.slug] : undefined;
  const sale = useSalePercent(product?.category.slug);
  const offerNotes = useOfferNotes(product?.category.slug);

  // Pre-select the customer's usual size for this category (if it's in stock)
  const { size: selSize, setSize: selSetSize, isSizeAvailable } = sel;
  useEffect(() => {
    if (remembered && !selSize && isSizeAvailable(remembered)) selSetSize(remembered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, remembered, sel.color]);

  // The "added" card hides itself after a few seconds
  useEffect(() => {
    if (!added) return;
    const id = setTimeout(() => setAdded(null), 5000);
    return () => clearTimeout(id);
  }, [added]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const shake = useAnimationControls();

  const related = useProducts({ category: product?.category.slug, exclude: product?.id, limit: 8 }, Boolean(product));

  // "Notify me when back" — which sold-out sizes of this product the customer is waiting for
  const qc = useQueryClient();
  const token = useCustomer((s) => s.token);
  const alertsQ = useQuery({
    queryKey: ['alerts', product?.id, token],
    queryFn: () => api<{ variantIds: string[] }>('/alerts', { query: { productId: product!.id } }).then((r) => r.variantIds),
    enabled: Boolean(product && token),
  });
  const [signInFor, setSignInFor] = useState<string | null>(null); // variant waiting for sign-in
  const [alertBusy, setAlertBusy] = useState(false);
  const tRef = useRef(t);
  tRef.current = t;

  const subscribe = useCallback(
    async (variantId: string) => {
      setAlertBusy(true);
      try {
        await api('/alerts', { body: { variantId } });
        haptic.success();
        toast.ok(tRef.current('product.notifySaved'));
        void qc.invalidateQueries({ queryKey: ['alerts'] });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : tRef.current('common.loadError'));
      } finally {
        setAlertBusy(false);
      }
    },
    [qc],
  );
  // Signed in from the sheet → finish the request the customer started
  useEffect(() => {
    if (token && signInFor) {
      const id = signInFor;
      setSignInFor(null);
      void subscribe(id);
    }
  }, [token, signInFor, subscribe]);

  if (isLoading) return <PageLoader />;
  if (error || !product) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return <ErrorState message={notFound ? t('product.notFound') : t('common.loadError')} onRetry={notFound ? undefined : () => refetch()} retryLabel={t('common.retry')} />;
  }

  const name = pick(product.nameEn, product.nameAm);
  const description = pick(product.descriptionEn, product.descriptionAm);
  const soldOut = !product.variants.some((v) => v.available > 0);
  const listPrice = sel.variant?.price ?? product.price;
  // A running sale lowers the price right here (the server applies exactly the same at checkout)
  const price = sale ? salePrice(listPrice, sale.percent) : listPrice;
  const lowStock = sel.variant && sel.variant.available > 0 && sel.variant.available <= 3 ? sel.variant.available : null;

  const addToBag = () => {
    if (sel.sizes.length && !sel.size) {
      haptic.error();
      pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      void shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.4 } });
      toast.error(t('product.selectSize'));
      return;
    }
    const v = sel.variant;
    if (!v || v.available <= 0) return;
    const image = product.images.find((i) => i.color && i.color === v.color) ?? product.images[0];
    add({
      variantId: v.id,
      productId: product.id,
      slug: product.slug,
      categorySlug: product.category.slug,
      preorder: Boolean(product.preorder),
      name: product.nameEn,
      image: image?.urls.sm ?? null,
      size: v.size,
      color: v.color,
      price: v.price,
      max: v.available,
    });
    rememberSize(product.category.slug, v.size);
    haptic.success();
    setAdded({ image: image?.urls.sm ?? null, name, detail: [v.size, v.color].filter(Boolean).join(' · ') });
  };

  // Once the chosen size is in the bag, the main button leads to the bag instead of adding again
  const inBag = Boolean(sel.variant && lines.some((l) => l.variantId === sel.variant!.id));
  const bagCount = lines.reduce((n, l) => n + l.quantity, 0);

  // Sold-out choice → offer "Notify me when back" instead of a dead button
  const alertVariant =
    sel.variant && sel.variant.available <= 0 ? sel.variant : soldOut && !sel.sizes.length ? (product.variants[0] ?? null) : null;
  const watching = Boolean(alertVariant && alertsQ.data?.includes(alertVariant.id));
  const needSizeForAlert = soldOut && sel.sizes.length > 0 && !sel.size;

  const toggleAlert = async () => {
    if (!alertVariant) return;
    if (watching) {
      await api(`/alerts/${alertVariant.id}`, { method: 'DELETE' }).catch(() => undefined);
      toast.ok(t('product.notifyOff'));
      void qc.invalidateQueries({ queryKey: ['alerts'] });
      return;
    }
    if (!token) return setSignInFor(alertVariant.id); // opens the Telegram sign-in sheet
    await subscribe(alertVariant.id);
  };

  const mainLabel = alertVariant
    ? watching
      ? t('product.notifyOn')
      : alertVariant.size
        ? t('product.notifyMeSize', { size: alertVariant.size })
        : t('product.notifyMe')
    : needSizeForAlert
      ? t('product.pickSizeNotify')
      : inBag
        ? t('product.inBag')
        : `${product.preorder ? t('pre.button') : t('product.addToBag')} · ${birr(price)}`;
  const mainAction = () => (alertVariant ? void toggleAlert() : needSizeForAlert || !inBag ? addToBag() : navigate('/bag'));
  const mainDisabled = alertBusy;

  const ask = () => {
    if (!config) return;
    const text = `${name}${sel.size ? ` · ${sel.size}` : ''}${sel.color ? ` · ${sel.color}` : ''}\n${window.location.origin}/p/${product.slug}`;
    openExternal(`https://t.me/${config.store.telegramInbox}?text=${encodeURIComponent(text)}`);
  };

  const f = product.fragrance;

  return (
    <div className="mx-auto max-w-7xl md:px-8 md:pt-8">
      {/* Photos + details. The details column stays pinned while scrolling, but only within this block,
          so it can never slide over the reviews / related products below. */}
      <div className="md:grid md:grid-cols-[1.25fr_1fr] md:gap-12">
      <Gallery images={product.images} alt={name} focusColor={sel.color} />

      <div className="px-4 pt-6 md:sticky md:top-24 md:self-start md:px-0 md:pt-0">
        {product.brand && <p className="label !text-camel">{product.brand.name}</p>}
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="display text-[1.75rem] md:text-[2.4rem]">{name}</h1>
          <HeartButton productId={product.id} className="mt-1 size-11 shrink-0 rounded-full border border-seam hover:border-steel" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Price value={price} compareAt={sale ? (product.compareAtPrice ?? listPrice) : product.compareAtPrice} className="text-lg" />
          {sale && <span className="rounded-full bg-ok/15 px-2.5 py-1 text-xs font-medium text-ok">{sale.name} · −{sale.percent}%</span>}
        </div>
        {product.preorder && (
          <p className="mt-3 rounded-xl border border-chalk/20 bg-chalk/[0.05] px-3 py-2.5 text-sm">
            <span className="font-semibold">{t('pre.badge')}</span>
            {product.preorder.note ? ` · ${product.preorder.note}` : ''}
            <span className="mt-0.5 block text-xs text-steel">{t('pre.hint')}</span>
          </p>
        )}
        {offerNotes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {offerNotes.map((n) => (
              <span key={n.id} className="rounded-full border border-camel/40 px-2.5 py-1 text-xs text-camel">
                {n.name} · {n.text}
              </span>
            ))}
          </div>
        )}
        {(product.rating || product.proofs.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <OriginalBadge product={product} />
            <RatingLink product={product} />
          </div>
        )}

        {sel.colors.length > 0 && (
          <div className="mt-8">
            <p className="label mb-3">
              {t('product.color')} <span className="ml-2 normal-case tracking-normal text-chalk">{sel.color}</span>
            </p>
            <div className="flex flex-wrap gap-2.5">
              {sel.colors.map((c) => {
                const available = sel.isColorAvailable(c.name);
                return (
                  <button
                    key={c.name}
                    onClick={() => {
                      haptic.select();
                      sel.setColor(c.name);
                      sel.setSize(sel.sizes.length === 1 ? sel.sizes[0]! : null);
                    }}
                    aria-label={c.name}
                    aria-pressed={sel.color === c.name}
                    className={cn(
                      'relative size-10 rounded-full p-[3px] ring-1 transition-shadow',
                      sel.color === c.name ? 'ring-2 ring-camel' : 'ring-seam hover:ring-steel',
                      !available && 'opacity-40',
                    )}
                  >
                    <span className="block size-full rounded-full ring-1 ring-inset ring-white/15" style={{ background: c.hex ?? "#555" }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sel.sizes.length > 0 && (
          <motion.div ref={pickerRef} animate={shake} className="mt-8">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="label">{t('product.size')}</p>
              <span className="flex items-center gap-4">
                {canSuggestSize(product.category) && (
                  <button onClick={() => setHelperOpen(true)} className="text-xs text-camel underline underline-offset-4 hover:text-chalk">
                    {t('size.findMine')}
                  </button>
                )}
                {product.category.sizeGuide && (
                  <button onClick={() => setGuideOpen(true)} className="text-xs text-steel underline underline-offset-4 hover:text-chalk">
                    {t('product.sizeGuide')}
                  </button>
                )}
              </span>
            </div>
            <TapeSizePicker sizes={sel.sizes} value={sel.size} isAvailable={sel.isSizeAvailable} onChange={sel.setSize} label={t('product.size')} />
            <p className={cn('mt-3 h-4 font-mono text-xs', lowStock ? 'text-camel' : sel.size && sel.size === remembered ? 'text-steel' : 'text-transparent')}>
              {lowStock ? t('product.onlyLeft', { n: lowStock }) : sel.size && sel.size === remembered ? `✓ ${t('size.yours')}` : '·'}
            </p>
          </motion.div>
        )}

        {/* Desktop add-to-bag (mobile uses the sticky / Telegram main button) */}
        <div className="mt-6 hidden md:block">
          <button
            onClick={mainAction}
            disabled={mainDisabled}
            className={cn(
              'h-14 w-full rounded-full font-semibold transition-colors disabled:opacity-40',
              inBag || watching ? 'border border-camel text-camel hover:bg-camel/10' : 'bg-camel text-ink hover:bg-camel-soft',
            )}
          >
            {mainLabel}
          </button>
        </div>

        <div className="mt-8 flex items-center gap-3 text-sm text-steel">
          <Truck className="size-4 shrink-0 text-camel" strokeWidth={1.6} />
          {t('product.deliveryText')}
        </div>

        <VideoTile product={product} />

        {description && <p className="mt-8 whitespace-pre-line leading-relaxed text-chalk/80">{description}</p>}

        <dl className="mt-6">
          <DetailRow label={t('product.fabric')} value={product.material} />
          <DetailRow label={t('product.fit')} value={product.fit} />
          <DetailRow label={t('product.origin')} value={product.origin} />
          {f && (
            <>
              <DetailRow label={t('product.volume')} value={[f.volumeMl ? `${f.volumeMl} ml` : null, f.concentration].filter(Boolean).join(' · ')} />
              <DetailRow label={t('product.family')} value={f.scentFamily} />
              <DetailRow label={t('product.notesTop')} value={f.notesTop.join(', ')} />
              <DetailRow label={t('product.notesHeart')} value={f.notesHeart.join(', ')} />
              <DetailRow label={t('product.notesBase')} value={f.notesBase.join(', ')} />
            </>
          )}
        </dl>

        <button onClick={ask} className="mt-6 flex w-full items-center justify-between rounded-xl border border-seam px-4 py-4 text-sm transition-colors hover:border-steel">
          <span className="flex items-center gap-3">
            <Send className="size-4 text-camel" strokeWidth={1.6} />
            {t('product.ask')}
          </span>
          <ChevronRight className="size-4 text-steel" />
        </button>
      </div>
      </div>

      <CompleteTheLook product={product} />

      <Reviews product={product} />

      {(related.data?.products.length ?? 0) > 0 && (
        <section className="mt-16 px-4 md:px-0">
          {/* Same-category picks: name them after the category ("More perfumes", "More suits") */}
          <h2 className="display mb-5 text-[1.35rem]">{t('product.moreOf', { category: pick(product.category.nameEn, product.category.nameAm) })}</h2>
          <ProductRail products={related.data?.products} />
        </section>
      )}

      <div className="md:hidden">
        <PrimaryAction label={mainLabel} onClick={mainAction} disabled={mainDisabled} />
      </div>

      {/* "Added to your bag" card: confirms the add and offers the next step */}
      <AnimatePresence>
        {added && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.3 }}
            className={cn(
              'fixed inset-x-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-seam bg-wool-2/95 p-3 shadow-2xl shadow-black/50 backdrop-blur md:inset-x-auto md:right-6 md:top-20 md:mx-0 md:w-96',
              usesNativeButton ? 'bottom-4' : 'bottom-[calc(140px+env(safe-area-inset-bottom))] md:bottom-auto',
            )}
          >
            {added.image ? <img src={added.image} alt="" className="aspect-[4/5] w-12 rounded-md object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Check className="size-4 text-camel" /> {t('product.addedTitle')}
              </p>
              <p className="mt-0.5 truncate text-xs text-steel">
                {added.name}
                {added.detail && ` · ${added.detail}`}
              </p>
            </div>
            <button
              onClick={() => navigate('/bag')}
              className="shrink-0 rounded-full bg-camel px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-camel-soft"
            >
              {t('product.viewBag')} ({bagCount})
            </button>
            <button onClick={() => setAdded(null)} className="shrink-0 p-1 text-steel hover:text-chalk" aria-label={t('common.close')}>
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <SizeGuide product={product} open={guideOpen} onClose={() => setGuideOpen(false)} />
      {canSuggestSize(product.category) && (
        <SizeHelper
          category={product.category}
          open={helperOpen}
          onClose={() => setHelperOpen(false)}
          isAvailable={sel.isSizeAvailable}
          onPick={(s) => sel.setSize(s)}
        />
      )}
      {/* Sign in to get the back-in-stock message on Telegram */}
      <Sheet open={Boolean(signInFor) && !token} onClose={() => setSignInFor(null)}>
        <TelegramLogin />
      </Sheet>
    </div>
  );
}
