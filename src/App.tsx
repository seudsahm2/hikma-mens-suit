import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { PageLoader } from './components/ui';
import { Toaster } from './components/ui/toast';
import { useLang } from './lib/i18n';
import { startParam, startParamToPath } from './lib/telegram';
import { useCustomer } from './store/auth';
import Home from './pages/Home';

const Shop = lazy(() => import('./pages/Shop'));
const ProductPage = lazy(() => import('./pages/Product'));
const Bag = lazy(() => import('./pages/Bag'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrdersPage = lazy(() => import('./pages/Orders').then((m) => ({ default: m.OrdersPage })));
const OrderPage = lazy(() => import('./pages/Orders').then((m) => ({ default: m.OrderPage })));
const InfoPage = lazy(() => import('./pages/Info').then((m) => ({ default: m.InfoPage })));
const NotFound = lazy(() => import('./pages/Info').then((m) => ({ default: m.NotFound })));
const AdminApp = lazy(() => import('./admin/AdminApp'));

const s = (el: React.ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

// A Mini App opened via t.me/<bot>/shop?startapp=p_<slug> lands on that product
const deepLink = startParamToPath(startParam);

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
      { path: 'orders/:orderNumber', element: s(<OrderPage />) },
      { path: 'info/:slug', element: s(<InfoPage />) },
      { path: '*', element: s(<NotFound />) },
    ],
  },
]);

export default function App() {
  const lang = useLang((st) => st.lang);
  const bootstrap = useCustomer((st) => st.bootstrap);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
