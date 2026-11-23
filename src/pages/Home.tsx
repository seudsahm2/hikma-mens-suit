import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, MapPin, Phone, Send } from 'lucide-react';
import { Mark } from '../components/brand/Mark';
import { ProductGrid, ProductRail } from '../components/product/ProductCard';
import { Button, buttonClass } from '../components/ui';
import { useCategories, useConfig, useProducts } from '../hooks/queries';
import { useT } from '../lib/i18n';
import { openExternal } from '../lib/telegram';
import type { StoreSettings } from '../lib/types';

function HeroMedia({ store, className }: { store: StoreSettings; className: string }) {
  return store.heroVideoUrl ? (
    <video
      className={className}
      src={store.heroVideoUrl}
      poster={store.heroImageUrl ?? undefined}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    />
  ) : store.heroImageUrl ? (
    <img className={className} src={store.heroImageUrl} alt="" fetchPriority="high" />
  ) : null;
}

/**
 * Phones: the shop's (vertical) video fills the screen behind the headline.
 * Desktop: headline left, video framed on the right — vertical clips never get stretched and blurred.
 */
function Hero({ store }: { store?: StoreSettings }) {
  const { t } = useT();
  const hasMedia = Boolean(store?.heroVideoUrl || store?.heroImageUrl);

  const headline = (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}>
      <p className="label mb-4 !text-camel">Betel · Addis Ababa</p>
      <h1 className="display whitespace-pre-line text-[clamp(2.9rem,13vw,7.5rem)] md:text-[clamp(3.5rem,7vw,7rem)]">{t('hero.title')}</h1>
      <Link to="/shop?sort=new" className={buttonClass('primary', 'lg', 'mt-8')}>
        {t('hero.cta')}
        <ArrowRight className="size-4" />
      </Link>
    </motion.div>
  );

  return (
    <section className="relative isolate overflow-hidden">
      {/* Phone layout */}
      <div className="relative flex min-h-[80svh] flex-col justify-end md:hidden">
        {store && hasMedia ? (
          <HeroMedia store={store} className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 -z-10 grid place-items-center">
            <Mark draw className="w-[92vw] translate-y-[-8%] opacity-[0.16]" fill="transparent" stroke="#B98B57" />
          </div>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/50 to-ink/10" />
        <div className="px-4 pb-10">{headline}</div>
      </div>

      {/* Desktop layout */}
      <div className="mx-auto hidden min-h-[82svh] max-w-7xl grid-cols-[1.15fr_1fr] items-center gap-12 px-8 py-12 md:grid">
        {headline}
        <div className="relative flex justify-end">
          {/* the collar mark, large and quiet, behind the frame */}
          <Mark className="absolute -left-10 top-1/2 w-[120%] max-w-none -translate-y-1/2 opacity-[0.06]" fill="transparent" stroke="#B98B57" />
          {store && hasMedia ? (
            <div className="relative aspect-[9/16] h-[72svh] max-h-[760px] overflow-hidden rounded-[28px] border border-seam shadow-[0_40px_120px_-40px_rgba(185,139,87,0.45)]">
              <HeroMedia store={store} className="size-full object-cover" />
              <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/10" />
            </div>
          ) : (
            <Mark draw className="relative w-[420px] opacity-25" fill="transparent" stroke="#B98B57" />
          )}
        </div>
      </div>
    </section>
  );
}

function SectionHead({ title, to }: { title: string; to?: string }) {
  const { t } = useT();
  return (
    <div className="mb-5 flex items-end justify-between">
      <h2 className="display text-[1.35rem] md:text-2xl">{title}</h2>
      {to && (
        <Link to={to} className="label inline-flex items-center gap-1 !text-chalk/70 hover:!text-chalk">
          {t('home.seeAll')} <ArrowUpRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function CategoryRail() {
  const { data } = useCategories();
  const { pick } = useT();
  const cats = data?.filter((c) => (c.productCount ?? 0) > 0) ?? [];
  if (!cats.length) return null;
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 md:-mx-8 md:px-8">
      {cats.map((c) => (
        <Link
          key={c.id}
          to={`/shop/${c.slug}`}
          className="group relative flex aspect-[4/5] w-[38vw] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-md border border-seam bg-wool p-3 md:w-52"
        >
          {c.imageUrl && (
            <img
              src={c.imageUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-[var(--ease-tailor)] group-hover:scale-[1.04]"
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" aria-hidden />
          <span className="display relative text-[0.9rem] leading-tight md:text-base">{pick(c.nameEn, c.nameAm)}</span>
          <span className="relative mt-1 font-mono text-[0.62rem] text-chalk/60">{c.productCount}</span>
        </Link>
      ))}
    </div>
  );
}

function VisitCard({ store }: { store: StoreSettings }) {
  const { t, pick } = useT();
  const mapsUrl =
    store.mapLat && store.mapLng
      ? `https://maps.google.com/?q=${store.mapLat},${store.mapLng}`
      : `https://maps.google.com/?q=${encodeURIComponent('Betel, Addis Ababa')}`;
  return (
    <section className="overflow-hidden rounded-xl border border-seam bg-wool">
      <div className="grid md:grid-cols-[1.2fr_1fr]">
        <div className="p-6 md:p-10">
          <p className="label !text-camel">{t('home.visit')}</p>
          <p className="display mt-4 text-[1.6rem] md:text-4xl">Shop G2</p>
          <p className="mt-3 max-w-sm text-steel">{pick(store.addressEn, store.addressAm)}</p>
          <p className="mt-1 font-mono text-xs text-steel">{store.openingHours}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            <a href={`tel:${store.phone}`} className={buttonClass('primary', 'sm')}>
              <Phone className="size-4" /> {t('common.call')}
            </a>
            <Button variant="outline" size="sm" onClick={() => openExternal(`https://t.me/${store.telegramInbox}`)}>
              <Send className="size-4" /> {t('common.telegram')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => openExternal(mapsUrl)}>
              <MapPin className="size-4" /> {t('home.directions')}
            </Button>
          </div>
        </div>
        <div className="relative hidden min-h-64 items-center justify-center border-l border-seam bg-ink md:flex">
          <Mark className="size-40" fill="transparent" stroke="#262C35" />
          <span className="display absolute bottom-6 right-6 text-6xl text-seam">G2</span>
        </div>
      </div>
    </section>
  );
}

function Footer({ store }: { store?: StoreSettings }) {
  const { t } = useT();
  return (
    <footer className="mx-auto mt-20 flex max-w-7xl flex-col gap-6 border-t border-seam px-4 py-10 text-sm text-steel md:flex-row md:items-center md:justify-between md:px-8">
      <div className="flex items-center gap-3">
        <Mark className="size-7" ring="#262C35" />
        <span>© {new Date().getFullYear()} Hikma Men’s Fashion</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/info/returns" className="hover:text-chalk">
          {t('info.returns')}
        </Link>
        {store?.tikTokHandle && (
          <button onClick={() => openExternal(`https://www.tiktok.com/@${store.tikTokHandle}`)} className="hover:text-chalk">
            TikTok
          </button>
        )}
        {store?.telegramChannelUrl && (
          <button onClick={() => openExternal(store.telegramChannelUrl)} className="hover:text-chalk">
            {t('common.telegram')}
          </button>
        )}
      </div>
    </footer>
  );
}

export default function Home() {
  const { t } = useT();
  const { data: config } = useConfig();
  const newIn = useProducts({ new: true, sort: 'new', limit: 10 });
  const picks = useProducts({ featured: true, sort: 'featured', limit: 8 });
  const perfume = useProducts({ category: 'perfumes', sort: 'new', limit: 10 });

  return (
    <>
      <Hero store={config?.store} />
      <div className="mx-auto max-w-7xl space-y-16 px-4 pt-8 md:space-y-24 md:px-8">
        <CategoryRail />

        <section>
          <SectionHead title={t('home.newIn')} to="/shop?sort=new" />
          <ProductRail products={newIn.data?.products} loading={newIn.isLoading} />
        </section>

        {(picks.data?.products.length ?? 0) > 0 && (
          <section>
            <SectionHead title={t('home.picks')} />
            <ProductGrid products={picks.data?.products.slice(0, 8)} />
          </section>
        )}

        {(perfume.data?.products.length ?? 0) > 0 && (
          <section className="-mx-4 border-y border-seam bg-wool px-4 py-12 md:-mx-8 md:px-8">
            <SectionHead title={t('home.perfume')} to="/shop/perfumes" />
            <ProductRail products={perfume.data?.products} />
          </section>
        )}

        {config && <VisitCard store={config.store} />}
      </div>
      <Footer store={config?.store} />
    </>
  );
}
