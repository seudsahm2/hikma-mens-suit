import { useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from '../ui/toast';
import { api } from '../../lib/api';
import { cn } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { haptic } from '../../lib/telegram';
import type { User } from '../../lib/types';
import { useCustomer } from '../../store/auth';

/** Customer switch for new-arrival messages from the bot (only shown when signed in). */
export function NewsToggle({ className }: { className?: string }) {
  const { t } = useT();
  const { token, user, setSession } = useCustomer();
  const [busy, setBusy] = useState(false);
  if (!token || !user) return null;
  const on = Boolean(user.newsOptIn);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await api<{ user: User }>('/auth/me', { method: 'PATCH', body: { newsOptIn: !on } });
      setSession({ token, user: res.user });
      haptic.success();
      toast.ok(res.user.newsOptIn ? t('news.on') : t('news.off'));
    } catch {
      toast.error(t('common.loadError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-4 rounded-xl border border-seam bg-wool p-4', className)}>
      <Bell className={cn('size-5 shrink-0', on ? 'text-camel' : 'text-steel')} strokeWidth={1.7} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t('news.title')}</p>
        <p className="mt-0.5 text-xs text-steel">{t('news.hint')}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t('news.title')}
        disabled={busy}
        onClick={toggle}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-camel' : 'bg-seam')}
      >
        <span className={cn('absolute left-0 top-0.5 size-5 rounded-full bg-chalk shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
