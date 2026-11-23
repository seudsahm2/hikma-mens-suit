import { useEffect, useRef, useState } from 'react';
import { Mark } from '../brand/Mark';
import { Spinner } from '../ui';
import { toast } from '../ui/toast';
import { api } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { isMiniApp } from '../../lib/telegram';
import type { User } from '../../lib/types';
import { useCustomer } from '../../store/auth';

const BOT = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined) ?? 'hikmafashionbot';

declare global {
  interface Window {
    onHikmaTelegramAuth?: (user: Record<string, string | number>) => void;
  }
}

/** Website sign-in with the official Telegram Login Widget. In the Mini App, sign-in is automatic. */
export function TelegramLogin() {
  const { t } = useT();
  const container = useRef<HTMLDivElement>(null);
  const setSession = useCustomer((s) => s.setSession);
  const status = useCustomer((s) => s.status);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isMiniApp || !container.current) return;
    window.onHikmaTelegramAuth = async (user) => {
      setBusy(true);
      try {
        const res = await api<{ token: string; user: User }>('/auth/telegram/widget', { body: user });
        setSession(res);
      } catch {
        toast.error(t('auth.failed'));
      } finally {
        setBusy(false);
      }
    };
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.setAttribute('data-telegram-login', BOT);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '999');
    s.setAttribute('data-request-access', 'write'); // lets the bot send order updates
    s.setAttribute('data-onauth', 'onHikmaTelegramAuth(user)');
    container.current.innerHTML = '';
    container.current.appendChild(s);
    return () => {
      delete window.onHikmaTelegramAuth;
    };
  }, [setSession, t]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <Mark className="size-16" ring="#262C35" />
      <h1 className="display mt-6 text-2xl">{t('auth.title')}</h1>
      <p className="mt-3 text-steel">{t('auth.why')}</p>
      <div className="mt-8 grid min-h-12 place-items-center">
        {(isMiniApp || status === 'loading' || busy) && <Spinner />}
        {!isMiniApp && <div ref={container} className={busy ? 'hidden' : undefined} />}
      </div>
      {import.meta.env.DEV && !isMiniApp && (
        <button
          onClick={async () => {
            try {
              setSession(await api<{ token: string; user: User }>('/auth/dev', { method: 'POST' }));
            } catch {
              toast.error('Set DEV_LOGIN=true in the backend .env');
            }
          }}
          className="mt-8 font-mono text-xs text-steel underline underline-offset-4 hover:text-chalk"
        >
          Developer sign-in (localhost only)
        </button>
      )}
    </div>
  );
}
