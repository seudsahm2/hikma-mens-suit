import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { motion, useAnimationControls } from 'motion/react';
import { ChevronRight, Send, Truck } from 'lucide-react';
import { Gallery } from '../components/product/Gallery';
import { ProductRail } from '../components/product/ProductCard';
import { TapeSizePicker } from '../components/product/TapeSizePicker';
import { PrimaryAction } from '../components/layout/PrimaryAction';
import { ErrorState, PageLoader, Price, Sheet } from '../components/ui';
import { toast } from '../components/ui/toast';
import { useConfig, useProduct, useProducts } from '../hooks/queries';
import { useT } from '../lib/i18n';
import { birr, cn, sortSizes } from '../lib/format';
import { haptic, openExternal } from '../lib/telegram';
import type { Product as P } from '../lib/types';
import { useCart } from '../store/cart';

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
  const [guideOpen, setGuideOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const shake = useAnimationControls();

  const related = useProducts({ category: product?.category.slug, exclude: product?.id, limit: 8 }, Boolean(product));

  if (isLoading) return <PageLoader />;
  if (error || !product) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return <ErrorState message={notFound ? t('product.notFound') : t('common.loadError')} onRetry={notFound ? undefined : () => refetch()} retryLabel={t('common.retry')} />;
  }

  const name = pick(product.nameEn, product.nameAm);
  const description = pick(product.descriptionEn, product.descriptionAm);
  const soldOut = !product.variants.some((v) => v.available > 0);
  const price = sel.variant?.price ?? product.price;
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
      name: product.nameEn,
      image: image?.urls.sm ?? null,
      size: v.size,
      color: v.color,
      price: v.price,
      max: v.available,
    });
    haptic.success();
    toast.ok(t('product.added'));
  };

  const ask = () => {
    if (!config) return;
    const text = `${name}${sel.size ? ` · ${sel.size}` : ''}${sel.color ? ` · ${sel.color}` : ''}\n${window.location.origin}/p/${product.slug}`;
    openExternal(`https://t.me/${config.store.telegramInbox}?text=${encodeURIComponent(text)}`);
  };

  const f = product.fragrance;

  return (
    <div className="mx-auto max-w-7xl md:grid md:grid-cols-[1.25fr_1fr] md:gap-12 md:px-8 md:pt-8">
      <Gallery images={product.images} alt={name} focusColor={sel.color} />

      <div className="px-4 pt-6 md:sticky md:top-24 md:self-start md:px-0 md:pt-0">
        {product.brand && <p className="label !text-camel">{product.brand.name}</p>}
        <h1 className="display mt-2 text-[1.75rem] md:text-[2.4rem]">{name}</h1>
        <Price value={price} compareAt={product.compareAtPrice} className="mt-3 block text-lg" />

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
              {product.category.sizeGuide && (
                <button onClick={() => setGuideOpen(true)} className="text-xs text-steel underline underline-offset-4 hover:text-chalk">
                  {t('product.sizeGuide')}
                </button>
              )}
            </div>
            <TapeSizePicker sizes={sel.sizes} value={sel.size} isAvailable={sel.isSizeAvailable} onChange={sel.setSize} label={t('product.size')} />
            <p className={cn('mt-3 h-4 font-mono text-xs', lowStock ? 'text-camel' : 'text-transparent')}>
              {lowStock ? t('product.onlyLeft', { n: lowStock }) : '·'}
            </p>
          </motion.div>
        )}

        {/* Desktop add-to-bag (mobile uses the sticky / Telegram main button) */}
        <div className="mt-6 hidden md:block">
          <button
            onClick={addToBag}
            disabled={soldOut}
            className="h-14 w-full rounded-full bg-camel font-semibold text-ink transition-colors hover:bg-camel-soft disabled:opacity-40"
          >
            {soldOut ? t('product.soldOut') : `${t('product.addToBag')} · ${birr(price)}`}
          </button>
        </div>

        <div className="mt-8 flex items-center gap-3 text-sm text-steel">
          <Truck className="size-4 shrink-0 text-camel" strokeWidth={1.6} />
          {t('product.deliveryText')}
        </div>

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

      {(related.data?.products.length ?? 0) > 0 && (
        <section className="col-span-2 mt-16 px-4 md:px-0">
          <h2 className="display mb-5 text-[1.35rem]">{t('product.related')}</h2>
          <ProductRail products={related.data?.products} />
        </section>
      )}

      <div className="md:hidden">
        <PrimaryAction
          label={soldOut ? t('product.soldOut') : `${t('product.addToBag')} · ${birr(price)}`}
          onClick={addToBag}
          disabled={soldOut}
        />
      </div>

      <SizeGuide product={product} open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
