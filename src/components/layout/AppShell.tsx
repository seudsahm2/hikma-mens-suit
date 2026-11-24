import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Home, LayoutGrid, ReceiptText, Search, ShoppingBag } from 'lucide-react';
import { Wordmark } from '../brand/Mark';
import { useTelegramBackButton } from './PrimaryAction';
import { useConfig } from '../../hooks/queries';
import { useT, useLang } from '../../lib/i18n';
import { cn } from '../../lib/format';
import { isMiniApp } from '../../lib/telegram';
import { cartCount, useCart } from '../../store/cart';
import { useCampaignBanner } from '../checkout/Offers';

function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'am' ? 'en' : 'am')}
      className="h-9 rounded-full border border-seam px-3 font-mono text-[0.7rem] tracking-widest text-steel transition-colors hover:text-chalk"
      aria-label={lang === 'am' ? 'Switch to English' : 'ወደ አማርኛ ቀይር'}
    >
      {lang === 'am' ? 'EN' : 'አማ'}
    </button>
  );
}

function BagLink({ className }: { className?: string }) {
  const count = useCart((s) => cartCount(s.lines));
  const { t } = useT();
  return (
    <Link to="/bag" className={cn('relative grid size-10 place-items-center rounded-full hover:bg-wool-2', className)} aria-label={t('nav.bag')}>
      <ShoppingBag className="size-[1.35rem]" strokeWidth={1.6} />
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 1.7 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          className="absolute right-0.5 top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-camel px-1 font-mono text-[0.6rem] font-medium leading-[1.1rem] text-ink"
        >
          {count}
        </motion.span>
      )}
    </Link>
  );
}

function Header() {
  const { t } = useT();
  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    cn('text-sm transition-colors', isActive ? 'text-chalk' : 'text-steel hover:text-chalk');
  return (
    <header className="sticky top-0 z-40 border-b border-seam/60 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link to="/" aria-label="Hikma Men’s Fashion — home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <NavLink to="/shop" className={desktopLink}>
            {t('nav.shop')}
          </NavLink>
          <NavLink to="/shop/suits" className={desktopLink}>
            {t('nav.suits')}
          </NavLink>
          <NavLink to="/shop/perfumes" className={desktopLink}>
            {t('home.perfume')}
          </NavLink>
          <NavLink to="/orders" className={desktopLink}>
            {t('nav.orders')}
          </NavLink>
        </nav>
        <div className="flex items-center gap-1">
          <Link to="/search" className="grid size-10 place-items-center rounded-full hover:bg-wool-2" aria-label="Search">
            <Search className="size-[1.3rem]" strokeWidth={1.6} />
          </Link>
          <BagLink className="hidden md:grid" />
          <LangToggle />
        </div>
      </div>
    </header>
  );
}

function Announcement() {
  const { data } = useConfig();
  const { pick } = useT();
  const campaign = useCampaignBanner(); // a running campaign (e.g. Eid offer) takes the banner
  const text = campaign ?? pick(data?.store.announcementEn, data?.store.announcementAm);
  if (!text) return null;
  return (
    <div className="border-b border-seam/60 bg-wool px-4 py-2 text-center font-mono text-[0.68rem] uppercase tracking-[0.14em] text-camel">
      {text}
    </div>
  );
}

function TabBar() {
  const { t } = useT();
  const count = useCart((s) => cartCount(s.lines));
  const tabs = [
    { to: '/', label: t('nav.home'), icon: Home, end: true },
    { to: '/shop', label: t('nav.shop'), icon: LayoutGrid },
    { to: '/bag', label: t('nav.bag'), icon: ShoppingBag, badge: count },
    { to: '/orders', label: t('nav.orders'), icon: ReceiptText },
  ];
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-seam bg-ink/95 backdrop-blur-md md:hidden" aria-label="Main">
      <ul className="grid h-16 grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, end, badge }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('relative flex h-full flex-col items-center justify-center gap-1 text-[0.68rem] transition-colors', isActive ? 'text-chalk' : 'text-steel')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('absolute top-0 h-[2px] w-8 rounded-full transition-colors', isActive ? 'bg-camel' : 'bg-transparent')} />
                  <span className="relative">
                    <Icon className="size-[1.3rem]" strokeWidth={isActive ? 2 : 1.6} />
                    {badge ? (
                      <motion.span
                        key={badge}
                        initial={{ scale: 1.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        className="absolute -right-2.5 -top-1.5 grid min-w-[1rem] place-items-center rounded-full bg-camel px-1 font-mono text-[0.58rem] leading-4 text-ink"
                      >
                        {badge}
                      </motion.span>
                    ) : null}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppShell() {
  useTelegramBackButton();
  return (
    <div className="min-h-dvh">
      <ScrollToTop />
      {!isMiniApp && <Announcement />}
      <Header />
      {isMiniApp && <Announcement />}
      <main className="pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-16">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
