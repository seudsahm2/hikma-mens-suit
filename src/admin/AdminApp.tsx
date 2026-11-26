import { Suspense, useState } from 'react';
import { lazyRetry } from '../lib/lazy';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, DatabaseBackup, ExternalLink, History, LifeBuoy, LineChart, LogOut, Send, ReceiptText, Settings, Shirt, Star, Store, Tag, Users, UserCog } from 'lucide-react';
import { Wordmark } from '../components/brand/Mark';
import { Button, Input, PageLoader } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/format';
import type { User } from '../lib/types';
import { useStaff } from '../store/auth';
import { adminApi } from './ui';

const Dashboard = lazyRetry(() => import('./pages/Dashboard'));
const Orders = lazyRetry(() => import('./pages/Orders'));
const OrderDetail = lazyRetry(() => import('./pages/OrderDetail'));
const DriverProfile = lazyRetry(() => import('./pages/DriverProfile'));
const Products = lazyRetry(() => import('./pages/Products'));
const ProductEditor = lazyRetry(() => import('./pages/ProductEditor'));
const Customers = lazyRetry(() => import('./pages/Customers'));
const Counter = lazyRetry(() => import('./pages/Counter'));
const ReviewsPage = lazyRetry(() => import('./pages/Reviews'));
const PromotionsPage = lazyRetry(() => import('./pages/Promotions'));
const CarePage = lazyRetry(() => import('./pages/Care'));
const InsightsPage = lazyRetry(() => import('./pages/Insights'));
const ActivityPage = lazyRetry(() => import('./pages/Activity'));
const BackupsPage = lazyRetry(() => import('./pages/Backups'));
const Staff = lazyRetry(() => import('./pages/Staff'));
const SettingsPage = lazyRetry(() => import('./pages/Settings'));

function Login() {
  const setSession = useStaff((s) => s.setSession);
  // login → forgot (phone) → reset (code from Telegram + new password)
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — try again');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'login') {
        setSession(await api<{ token: string; user: User }>('/auth/staff/login', { body: { phone, password } }));
      } else if (mode === 'forgot') {
        await api('/auth/staff/forgot', { body: { phone } });
        setPassword('');
        setMode('reset');
      } else {
        setSession(await api<{ token: string; user: User }>('/auth/staff/reset', { body: { phone, code, password } }));
      }
    });
  };

  const switchTo = (m: 'login' | 'forgot') => {
    setMode(m);
    setError('');
    setCode('');
    setPassword('');
  };

  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <Wordmark />
        <h1 className="display pt-6 text-2xl">{mode === 'login' ? 'Shop admin' : 'Reset password'}</h1>
        {mode !== 'login' && (
          <p className="text-sm text-steel">
            {mode === 'forgot'
              ? 'We’ll send a 6-digit code to the Telegram connected to your account.'
              : 'If this phone has Telegram connected, a code is on its way. Enter it with your new password.'}
          </p>
        )}
        <Input
          name="phone"
          label="Phone"
          type="tel"
          autoComplete="username"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={mode === 'reset'}
          error={mode === 'forgot' ? error || undefined : undefined}
        />
        {mode === 'reset' && (
          <Input
            name="code"
            label="Code from Telegram"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        )}
        {mode !== 'forgot' && (
          <Input
            name="password"
            label={mode === 'reset' ? 'New password (8+ characters)' : 'Password'}
            type="password"
            autoComplete={mode === 'reset' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error || undefined}
          />
        )}
        <Button
          type="submit"
          variant="accent"
          size="lg"
          block
          loading={busy}
          disabled={!phone || (mode === 'login' && !password) || (mode === 'reset' && (code.length !== 6 || password.length < 8))}
        >
          {mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send code' : 'Save new password'}
        </Button>
        <div className="flex justify-center text-sm">
          {mode === 'login' ? (
            <button type="button" onClick={() => switchTo('forgot')} className="text-steel hover:text-chalk">
              Forgot password?
            </button>
          ) : (
            <div className="flex gap-5">
              {mode === 'reset' && (
                <button type="button" onClick={() => switchTo('forgot')} className="text-steel hover:text-chalk">
                  Send a new code
                </button>
              )}
              <button type="button" onClick={() => switchTo('login')} className="text-steel hover:text-chalk">
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function Shell() {
  const { user, signOut } = useStaff();
  const navigate = useNavigate();
  const isOwner = user?.role === 'OWNER';
  const { data } = useQuery({
    queryKey: ['admin', 'badge'],
    queryFn: () => adminApi<{ needsReview: number }>('/orders', { query: { limit: 1 } }),
    refetchInterval: 60_000,
  });
  // Customer care badge: open questions waiting for staff + exchange requests
  const care = useQuery({
    queryKey: ['admin', 'care-badge'],
    queryFn: async () => {
      const [help, ex] = await Promise.all([
        adminApi<{ requests: { lastFrom: string }[] }>('/support', { query: { status: 'open' } }),
        adminApi<{ open: number }>('/exchanges', { query: { status: 'requested' } }),
      ]);
      return help.requests.filter((r) => r.lastFrom === 'customer').length + ex.open;
    },
    refetchInterval: 60_000,
  });

  const links = [
    { to: '/admin', label: 'Overview', icon: BarChart3, end: true },
    { to: '/admin/orders', label: 'Orders', icon: ReceiptText, badge: data?.needsReview },
    { to: '/admin/care', label: 'Customer care', icon: LifeBuoy, badge: care.data || undefined },
    { to: '/admin/products', label: 'Products', icon: Shirt },
    { to: '/admin/counter', label: 'Shop counter', icon: Store },
    { to: '/admin/customers', label: 'Customers', icon: Users },
    { to: '/admin/insights', label: 'Insights', icon: LineChart },
    { to: '/admin/reviews', label: 'Reviews', icon: Star },
    ...(isOwner
      ? [
          { to: '/admin/promotions', label: 'Promotions', icon: Tag },
          { to: '/admin/staff', label: 'Admins', icon: UserCog },
          { to: '/admin/activity', label: 'Activity', icon: History },
          { to: '/admin/backups', label: 'Backups', icon: DatabaseBackup },
          { to: '/admin/settings', label: 'Settings', icon: Settings },
        ]
      : []),
  ];

  const link = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9rem] transition-colors',
      isActive ? 'bg-gradient-to-r from-wool-2 to-transparent text-chalk' : 'text-steel hover:text-chalk',
    );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-seam/80 bg-[radial-gradient(120%_60%_at_0%_0%,rgba(185,139,87,0.08),transparent_60%)] p-4 md:flex">
        <div className="px-2 pb-2 pt-3">
          <Wordmark />
        </div>
        <p className="label mt-8 px-3 !text-[0.6rem]">Back office</p>
        <nav className="mt-3 space-y-0.5">
          {links.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={link}>
              {({ isActive }) => (
                <>
                  <span
                    className={cn('absolute -left-4 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-colors', isActive ? 'bg-camel' : 'bg-transparent')}
                    aria-hidden
                  />
                  <Icon className={cn('size-[1.05rem]', isActive && 'text-camel')} strokeWidth={1.7} />
                  <span className="flex-1">{label}</span>
                  {badge ? <span className="animate-pulse rounded-full bg-camel px-1.5 font-mono text-[0.65rem] text-ink">{badge}</span> : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <a href="/" target="_blank" rel="noreferrer" className="mx-3 mt-6 inline-flex items-center gap-2 text-[0.8rem] text-steel hover:text-camel">
          <ExternalLink className="size-3.5" /> View shop
        </a>
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-seam/80 bg-wool p-3">
          <span className="grid size-9 place-items-center rounded-full bg-camel font-display text-sm font-bold text-ink">{user?.fullName.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{user?.fullName}</p>
            <p className="label !text-[0.58rem]">{user?.role === 'OWNER' ? 'Owner' : 'Admin'}</p>
          </div>
          <button
            onClick={async () => {
              // Connect this staff account to the owner's own Telegram (order-card actions become theirs)
              const tab = window.open('', '_blank');
              try {
                const r = await api<{ url: string }>('/auth/staff-telegram', { method: 'POST', auth: 'staff' });
                if (tab) tab.location.href = r.url;
                else window.location.href = r.url;
              } catch {
                tab?.close();
              }
            }}
            className="rounded-full p-2 text-steel hover:text-chalk"
            aria-label="Connect Telegram"
            title="Connect Telegram — tap Start in the bot"
          >
            <Send className="size-4" />
          </button>
          <button
            onClick={() => {
              signOut();
              navigate('/admin');
            }}
            className="rounded-full p-2 text-steel hover:text-chalk"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* Mobile top bar + scrollable tabs */}
      <div className="sticky top-0 z-30 border-b border-seam bg-ink/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Wordmark />
          <button onClick={signOut} className="rounded-full p-2 text-steel" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
          {links.map(({ to, label, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[0.8rem]', isActive ? 'bg-chalk text-ink' : 'text-steel')
              }
            >
              {label}
              {badge ? <span className="rounded-full bg-camel px-1.5 font-mono text-[0.6rem] text-ink">{badge}</span> : null}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="min-w-0 px-4 py-6 md:px-10 md:py-12">
        <TelegramBanner />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="drivers/:id" element={<DriverProfile />} />
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductEditor />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="customers" element={<Customers />} />
            <Route path="counter" element={<Counter />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="care" element={<CarePage />} />
            <Route path="insights" element={<InsightsPage />} />
            {isOwner && <Route path="activity" element={<ActivityPage />} />}
            {isOwner && <Route path="backups" element={<BackupsPage />} />}
            <Route path="exchanges" element={<Navigate to="/admin/care?tab=exchanges" replace />} />
            {isOwner && <Route path="promotions" element={<PromotionsPage />} />}
            {isOwner && <Route path="staff" element={<Staff />} />}
            {isOwner && <Route path="settings" element={<SettingsPage />} />}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default function AdminApp() {
  const token = useStaff((s) => s.token);
  return token ? <Shell /> : <Login />;
}


/**
 * Shown on every admin page until this staff account has its Telegram connected —
 * it's what makes "Forgot password?" work (the reset code goes there).
 */
function TelegramBanner() {
  const q = useQuery({
    queryKey: ['admin', 'my-telegram'],
    queryFn: () => api<{ connected: boolean }>('/auth/staff-telegram', { auth: 'staff' }),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.connected === false ? 5000 : false),
  });
  if (q.data?.connected !== false) return null;
  const connect = async () => {
    const tab = window.open('', '_blank');
    try {
      const r = await api<{ url: string }>('/auth/staff-telegram', { method: 'POST', auth: 'staff' });
      if (tab) tab.location.href = r.url;
      else window.location.href = r.url;
    } catch {
      tab?.close();
    }
  };
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#2AABEE]/30 bg-[#2AABEE]/[0.07] p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#2AABEE] text-white">
        <Send className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Connect your Telegram</p>
        <p className="text-sm text-steel">It’s how you reset your password if you forget it. Check which account is open in Telegram first.</p>
      </div>
      <button onClick={connect} className="h-10 shrink-0 rounded-full bg-[#2AABEE] px-5 text-sm font-semibold text-white hover:bg-[#229ED9]">
        Connect
      </button>
    </div>
  );
}
