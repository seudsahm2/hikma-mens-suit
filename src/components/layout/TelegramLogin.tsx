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

interface LoginLink {
  token: string;
  url: string;
  expiresAt: number;
}

/**
 * Website sign-in through the shop's bot:
 * tap → Telegram opens @hikmafashionbot → tap Start → this page signs in automatically.
 * No phone number and no confirmation code. (Inside the Mini App, sign-in is automatic.)
 */
export function TelegramLogin() {
  const { t } = useT();
  const setSession = useCustomer((s) => s.setSession);
  const status = useCustomer((s) => s.status);
  const [link, setLink] = useState<LoginLink | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checking = useRef(false);

  const prepare = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ token: string; url: string; expiresInSeconds: number }>('/auth/telegram/bot-login', { method: 'POST' });
      setLink({ token: r.token, url: r.url, expiresAt: Date.now() + (r.expiresInSeconds - 20) * 1000 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.failed'));
    }
  }, [t]);

  // Prepare a link up front so the button is a real link (no popup blockers), and refresh it before it expires
  useEffect(() => {
    if (isMiniApp) return;
    void prepare();
  }, [prepare]);
  useEffect(() => {
    if (!link || waiting) return;
    const id = setTimeout(() => void prepare(), Math.max(5_000, link.expiresAt - Date.now()));
    return () => clearTimeout(id);
  }, [link, waiting, prepare]);

  const check = useCallback(async () => {
    if (!link || checking.current) return;
    checking.current = true;
    try {
      const r = await api<{ status: 'pending' | 'confirmed'; token?: string; user?: User }>(`/auth/telegram/bot-login/${link.token}`);
      if (r.status === 'confirmed' && r.token && r.user) setSession({ token: r.token, user: r.user });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setWaiting(false);
        toast.error(t('auth.expired'));
        void prepare();
      }
    } finally {
      checking.current = false;
    }
  }, [link, prepare, setSession, t]);

  // While waiting: check every 2 s, and immediately when the user switches back from Telegram
  useEffect(() => {
    if (!waiting) return;
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

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <Mark className="size-16" ring="#262C35" />
      <h1 className="display mt-6 text-2xl">{t('auth.title')}</h1>
      <p className="mt-3 text-steel">{t('auth.why')}</p>

      <div className="mt-8 w-full">
        {isMiniApp || status === 'loading' ? (
          <Spinner className="mx-auto" />
        ) : error ? (
          <button onClick={() => void prepare()} className={buttonClass('outline', 'lg', 'w-full')}>
            {t('common.retry')}
          </button>
        ) : (
          <a
            href={link?.url ?? '#'}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!link}
            onClick={(e) => {
              if (!link) return e.preventDefault();
              setWaiting(true);
            }}
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
