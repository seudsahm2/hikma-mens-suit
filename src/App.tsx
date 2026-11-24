import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { PageLoader } from './components/ui';
import { Toaster } from './components/ui/toast';
import { useLang } from './lib/i18n';
import { startParam, startParamToPath } from './lib/telegram';
import { useCustomer, useStaff } from './store/auth';
import { useCart } from './store/cart';
import { useBagSync } from './lib/bagSync';
import { captureInviteCode, useAttachInvite } from './components/checkout/Offers';
import { useWishlistSync } from './store/wishlist';
import Home from './pages/Home';

const Shop = lazy(() => import('./pages/Shop'));
const ProductPage = lazy(() => import('./pages/Product'));
const Bag = lazy(() => import('./pages/Bag'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrdersPage = lazy(() => import('./pages/Orders').then((m) => ({ default: m.OrdersPage })));
const AccountPage = lazy(() => import('./pages/Account'));
const SavedPage = lazy(() => import('./pages/Saved'));
const OrderPage = lazy(() => import('./pages/Orders').then((m) => ({ default: m.OrderPage })));
const InfoPage = lazy(() => import('./pages/Info').then((m) => ({ default: m.InfoPage })));
const NotFound = lazy(() => import('./pages/Info').then((m) => ({ default: m.NotFound })));
const AdminApp = lazy(() => import('./admin/AdminApp'));

const s = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

// A Mini App opened via t.me/<bot>/shop?startapp=p_<slug> lands on that product
const deepLink = startParamToPath(startParam);
captureInviteCode(); // ?ref=CODE or Telegram startapp=ref_CODE → pre-fills the code at checkout

const router = createBrowserRouter([
  {
    path: '/admin/*',
    element: s(<AdminApp />),
  },
  {
    element: <AppShell />,
    children: [
      { index: true, element: deepLink && window.location.pathname === '/' ? <Navigate to={deepLink} replace /> : <Home /> },
      { path: 'shop', element: s(<Shop />) },
      { path: 'shop/:category', element: s(<Shop />) },
      { path: 'search', element: s(<Shop search />) },
      { path: 'p/:slug', element: s(<ProductPage />) },
      { path: 'bag', element: s(<Bag />) },
      { path: 'checkout', element: s(<Checkout />) },
      { path: 'orders', element: s(<OrdersPage />) },
      { path: 'account', element: s(<AccountPage />) },
      { path: 'saved', element: s(<SavedPage />) },
      { path: 'orders/:orderNumber', element: s(<OrderPage />) },
      { path: 'info/:slug', element: s(<InfoPage />) },
      { path: '*', element: s(<NotFound />) },
    ],
  },
]);

export default function App() {
  const lang = useLang((st) => st.lang);
  const bootstrap = useCustomer((st) => st.bootstrap);
  useBagSync();
  useAttachInvite();
  useWishlistSync();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Keep open tabs in sync: signing in through the bot often opens the site in a new tab,
  // and the bag can change in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hikma-customer') void useCustomer.persist.rehydrate();
      if (e.key === 'hikma-bag') void useCart.persist.rehydrate();
      if (e.key === 'hikma-staff') void useStaff.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
