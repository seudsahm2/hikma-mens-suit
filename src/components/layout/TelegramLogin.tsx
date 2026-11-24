import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Mark } from '../brand/Mark';
import { Spinner, buttonClass } from '../ui';
import { toast } from '../ui/toast';
import { api, ApiError } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { isMiniApp } from '../../lib/telegram';
import type { User } from '../../lib/types';
import { useCustomer } from '../../store/auth';

/**
 * Website sign-in through the shop's bot:
 *   tap → Telegram opens @hikmafashionbot → tap Start → this page signs in by itself.
 *
 * Robustness rules:
 *  - One pending link per tab, kept in sessionStorage: reloads reuse it, and if the user already tapped
 *    Start before reloading, the confirmation is picked up instead of asking again.
 *  - Callbacks never depend on per-render values (that caused a request loop before).
 *  - Errors are shown as they are; when the server says "wait", the page counts down and retries.
 * (Inside the Mini App sign-in is automatic and this screen only shows a spinner.)
 */

interface PendingLink {
  token: string;
  url: string;
  expiresAt: number;
  started?: boolean; // the user opened Telegram with this link
}

const STORAGE_KEY = 'hikma-signin-link';

const loadPending = (): PendingLink | null => {
  try {
    const p = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as PendingLink | null;
    return p && p.expiresAt - Date.now() > 30_000 ? p : null;
  } catch {
    return null;
  }
};
const savePending = (p: PendingLink | null) => {
  if (p) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  else sessionStorage.removeItem(STORAGE_KEY);
};

export function TelegramLogin() {
  const { t } = useT();
  const setSession = useCustomer((s) => s.setSession);
  const status = useCustomer((s) => s.status);
  const [link, setLink] = useState<PendingLink | null>(() => (isMiniApp ? null : loadPending()));
  const [waiting, setWaiting] = useState(() => Boolean(link?.started));
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const tRef = useRef(t);
  tRef.current = t;
  const busy = useRef(false);

  /** Gets a pending link (reusing this tab's one when still valid). Stable: no per-render dependencies. */
  const prepare = useCallback(async (force = false) => {
    if (busy.current) return;
    const existing = force ? null : loadPending();
    if (existing) {
      setLink(existing);
      return;
    }
    busy.current = true;
    setError(null);
    try {
      const r = await api<{ token: string; url: string; expiresInSeconds: number }>('/auth/telegram/bot-login', { method: 'POST' });
      const p: PendingLink = { token: r.token, url: r.url, expiresAt: Date.now() + r.expiresInSeconds * 1000 };
      savePending(p);
      setLink(p);
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      setError(e?.message ?? tRef.current('auth.failed'));
      if (e?.retryAfter) setRetryIn(Math.min(e.retryAfter, 900));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isMiniApp && !link) void prepare();
    // run once on mount; later refreshes are explicit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server asked us to wait: count down, then retry automatically
  useEffect(() => {
    if (retryIn <= 0) return;
    const id = setTimeout(() => {
      if (retryIn === 1) void prepare(true);
      setRetryIn((s) => s - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [retryIn, prepare]);

  // Refresh an unused link shortly before it expires
  useEffect(() => {
    if (!link || waiting) return;
    const id = setTimeout(() => void prepare(true), Math.max(5_000, link.expiresAt - Date.now() - 30_000));
    return () => clearTimeout(id);
  }, [link, waiting, prepare]);

  const check = useCallback(async () => {
    const current = loadPending();
    if (!current) return;
    try {
      const r = await api<{ status: 'pending' | 'confirmed'; token?: string; user?: User }>(`/auth/telegram/bot-login/${current.token}`);
      if (r.status === 'confirmed' && r.token && r.user) {
        savePending(null);
        setSession({ token: r.token, user: r.user });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        savePending(null);
        setWaiting(false);
        toast.error(tRef.current('auth.expired'));
        void prepare(true);
      }
      // other errors (network, server waking up): keep waiting, the next check retries
    }
  }, [prepare, setSession]);

  // While waiting: check every 2 s, and immediately when the user comes back from Telegram
  useEffect(() => {
    if (!waiting) return;
    void check();
    const id = setInterval(() => void check(), 2000);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [waiting, check]);

  const onOpenTelegram = (e: React.MouseEvent) => {
    if (!link) return e.preventDefault();
    const started = { ...link, started: true };
    savePending(started);
    setLink(started);
    setWaiting(true);
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <Mark className="size-16" ring="#262C35" />
      <h1 className="display mt-6 text-2xl">{t('auth.title')}</h1>
      <p className="mt-3 text-steel">{t('auth.why')}</p>

      <div className="mt-8 w-full">
        {isMiniApp || status === 'loading' ? (
          <Spinner className="mx-auto" />
        ) : error && !link ? (
          <div className="space-y-3">
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
            <button onClick={() => void prepare(true)} disabled={retryIn > 0} className={buttonClass('outline', 'lg', 'w-full')}>
              {retryIn > 0 ? `${t('common.retry')} · ${retryIn}s` : t('common.retry')}
            </button>
          </div>
        ) : (
          <a
            href={link?.url ?? '#'}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!link}
            onClick={onOpenTelegram}
            className={buttonClass('accent', 'lg', `w-full ${!link ? 'pointer-events-none opacity-50' : ''}`)}
          >
            <Send className="size-4" />
            {waiting ? t('auth.openAgain') : t('auth.button')}
          </a>
        )}
      </div>

      {waiting && (
        <div className="mt-6 flex items-center gap-3 text-sm text-steel" role="status">
          <Spinner className="size-4" />
          {t('auth.waiting')}
        </div>
      )}

      {import.meta.env.DEV && !isMiniApp && (
        <button
          onClick={async () => {
            try {
              setSession(await api<{ token: string; user: User }>('/auth/dev', { method: 'POST' }));
            } catch {
              toast.error('Set DEV_LOGIN=true in the backend .env');
            }
          }}
          className="mt-10 font-mono text-xs text-steel underline underline-offset-4 hover:text-chalk"
        >
          Developer sign-in (localhost only)
        </button>
      )}
    </div>
  );
}
