/**
 * Desktop hero — an editorial "cover":
 *  - the shop's own video, softly blurred, fills the whole background (atmosphere, not flat black)
 *  - the sharp video in a big frame at the centre of a stage, with two of the newest pieces floating
 *    beside it as tilted cards (clickable, name + price)
 *  - headline, one line, actions and trust chips on the left
 *  - a slowly scrolling tape-measure strip of the categories along the bottom
 * Always dark (cinematic), also in light mode.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, BadgeCheck, Play, RefreshCw, Truck, Wallet } from 'lucide-react';
import { Mark } from '../brand/Mark';
import { buttonClass, Img, Price } from '../ui';
import { useT } from '../../lib/i18n';
import { isMiniApp, openExternal } from '../../lib/telegram';
import type { Category, ProductCard, StoreSettings } from '../../lib/types';
import { salePrice, useSaleFor } from '../checkout/Offers';
import { SoundToggle } from './heroSound';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Atmosphere behind the hero: a tiny snapshot of the playing hero video (or the cover photo), blurred
 * and scaled up. It's refreshed every few seconds — NOT a second playing video with a full-screen blur
 * (that repainted the whole screen every frame and made every click on the page slow).
 */
function Ambient({ store, stage }: { store: StoreSettings; stage: React.RefObject<HTMLDivElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState(false);
  useEffect(() => {
    const draw = () => {
      const v = stage.current?.querySelector('video');
      const c = canvas.current;
      if (!v || !c || v.readyState < 2 || document.hidden) return;
      try {
        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
        setSnap(true);
      } catch {
        /* video not drawable: the cover photo stays */
      }
    };
    const first = window.setTimeout(draw, 1200);
    const timer = window.setInterval(draw, 4000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [stage]);
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {store.heroImageUrl && <img src={store.heroImageUrl} alt="" className={`absolute inset-0 size-full scale-125 object-cover blur-2xl saturate-150 transition-opacity duration-1000 ${snap ? 'opacity-0' : 'opacity-40'}`} />}
      {/* 18×32 pixels, stretched: the GPU smooths it into soft colour — no expensive blur filter needed */}
      <canvas ref={canvas} width={18} height={32} className={`absolute inset-0 size-full scale-125 blur-2xl saturate-150 transition-opacity duration-1000 ${snap ? 'opacity-50' : 'opacity-0'}`} />
      <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_62%_45%,transparent,rgba(13,16,21,0.75)_70%,#0d1015)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
    </div>
  );
}

function FloatingPiece({ product, className, rotate, delay }: { product: ProductCard; className: string; rotate: number; delay: number }) {
  const { pick } = useT();
  const saleFor = useSaleFor();
  const pct = saleFor(product.category.slug);
  return (
    <motion.div
      className={`absolute z-20 w-[13.5rem] ${className}`}
      initial={{ opacity: 0, y: 40, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 1, ease: EASE, delay }}
    >
      <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6 + delay * 2, repeat: Infinity, ease: 'easeInOut' }}>
        <Link
          to={`/p/${product.slug}`}
          className="group block overflow-hidden rounded-2xl border border-white/10 bg-wool shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] transition-transform duration-500 hover:-translate-y-1"
        >
          <Img urls={product.images[0]?.urls} alt={pick(product.nameEn, product.nameAm)} sizes="220px" className="aspect-[4/5] w-full transition-transform duration-700 group-hover:scale-[1.04]" />
          <div className="flex items-end justify-between gap-2 px-3.5 py-3">
            <div className="min-w-0">
              <p className="label !text-[0.55rem] !text-camel">New in</p>
              <p className="truncate text-sm">{pick(product.nameEn, product.nameAm)}</p>
            </div>
            <Price value={pct ? salePrice(product.price, pct) : product.price} className="shrink-0 text-xs text-chalk/90" />
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function DesktopHero({ store, products, categories, video }: { store?: StoreSettings; products: ProductCard[]; categories: Category[]; video: React.ReactNode }) {
  const { t, pick } = useT();
  const pieces = products.filter((p) => p.images.length).slice(0, 2);
  const hasMedia = Boolean(store?.heroVideoUrl || store?.heroImageUrl);
  const stageRef = useRef<HTMLDivElement>(null);
  const strip = categories.length ? categories.map((c) => pick(c.nameEn, c.nameAm)) : ['Suits', 'Shirts', 'Shoes', 'Perfume', 'Jackets'];

  return (
    <div className="stay-dark relative isolate hidden min-h-[88svh] overflow-hidden bg-ink text-chalk md:block">
      {store && <Ambient store={store} stage={stageRef} />}

      <div className="mx-auto grid min-h-[calc(88svh-3.5rem)] max-w-7xl grid-cols-[0.9fr_1.1fr] items-center gap-6 px-8 py-14">
        {/* Words */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }} className="relative z-10">
          <p className="label mb-5 flex items-center gap-3 !text-camel">
            <span className="h-px w-10 bg-camel" /> Betel · Addis Ababa
          </p>
          <h1 className="display whitespace-pre-line text-[clamp(3.6rem,6.4vw,6.6rem)] leading-[0.92]">{t('hero.title')}</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-chalk/70">{t('hero.sub')}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/shop?sort=new" className={buttonClass('accent', 'lg')}>
              {t('hero.cta')} <ArrowRight className="size-4" />
            </Link>
            {store?.tikTokHandle && (
              <a
                href={`https://www.tiktok.com/@${store.tikTokHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  // Website: a plain link (the browser opens the tab, no page work). Telegram: its own browser.
                  if (isMiniApp) {
                    e.preventDefault();
                    openExternal(`https://www.tiktok.com/@${store.tikTokHandle}`);
                  }
                }}
                className="inline-flex h-14 items-center gap-2.5 rounded-full border border-white/15 px-6 text-sm font-semibold transition-colors hover:border-white/40"
              >
                <span className="grid size-7 place-items-center rounded-full bg-chalk text-ink">
                  <Play className="ml-0.5 size-3.5 fill-ink" />
                </span>
                {t('hero.watch')}
              </a>
            )}
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-chalk/60">
            {(
              [
                [Truck, t('hero.t1')],
                [Wallet, t('hero.t2')],
                [RefreshCw, t('hero.t3')],
                [BadgeCheck, t('hero.t4')],
              ] as const
            ).map(([Icon, label]) => (
              <li key={label} className="inline-flex items-center gap-2">
                <Icon className="size-4 text-camel" strokeWidth={1.6} /> {label}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Stage */}
        <div ref={stageRef} className="relative flex h-[74svh] max-h-[780px] items-center justify-center">
          <Mark className="absolute left-1/2 top-1/2 w-[110%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" fill="transparent" stroke="#B98B57" />
          {store && hasMedia ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, ease: EASE }}
              className="relative z-10 aspect-[9/16] h-full overflow-hidden rounded-[32px] border border-white/10 shadow-[0_60px_140px_-40px_rgba(185,139,87,0.55)]"
            >
              {video}
              <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/10" />
              <SoundToggle className="absolute right-4 top-4 z-30" />
            </motion.div>
          ) : (
            <Mark draw className="relative w-[420px] opacity-25" fill="transparent" stroke="#B98B57" />
          )}
          {pieces[0] && <FloatingPiece product={pieces[0]} className="left-[2%] top-[14%]" rotate={-6} delay={0.45} />}
          {pieces[1] && <FloatingPiece product={pieces[1]} className="bottom-[8%] right-[1%]" rotate={5} delay={0.65} />}
        </div>
      </div>

      {/* Tape-measure strip of the categories */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-white/10 bg-ink/90">
        <div className="flex w-max animate-[hikma-marquee_40s_linear_infinite] items-center py-3.5 hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
              {[...strip, ...strip].map((name, i) => (
                <span key={`${copy}-${i}`} className="flex items-center">
                  <span className="display px-6 text-sm tracking-[0.08em] text-chalk/80">{name}</span>
                  <span className="flex items-end gap-[5px]" aria-hidden>
                    {Array.from({ length: 9 }, (_, k) => (
                      <span key={k} className={k === 4 ? 'h-3 w-px bg-camel' : 'h-1.5 w-px bg-white/25'} />
                    ))}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
