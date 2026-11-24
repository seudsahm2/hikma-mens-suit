import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Download, Heart, LogOut, Moon, Phone, ReceiptText, Send, Sun } from 'lucide-react';
import { useDataSaverStore } from '../store/dataSaver';
import { useInstall } from '../lib/install';
import { useWishlist } from '../store/wishlist';
import { TelegramLogin } from '../components/layout/TelegramLogin';
import { NewsToggle } from '../components/layout/NewsToggle';
import { RewardsCard } from '../components/checkout/Offers';
import { PageLoader } from '../components/ui';
import { toast } from '../components/ui/toast';
import { useLang, useT } from '../lib/i18n';
import { cn } from '../lib/format';
import { isMiniApp, tg } from '../lib/telegram';
import { useCustomer } from '../store/auth';
import { useTheme } from '../store/theme';
import { Avatar } from '../components/layout/Avatar';

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full border border-seam p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn('flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors', value === o.value ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Preferences() {
  const { t } = useT();
  const { lang, setLang } = useLang();
  const { theme, setTheme } = useTheme();
  const { choice, setChoice } = useDataSaverStore();
  const install = useInstall();
  return (
    <section>
      <h2 className="label mb-2.5 px-1">{t('acc.prefs')}</h2>
      <div className="divide-y divide-seam/70 rounded-2xl border border-seam/80 bg-wool">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm">{t('acc.language')}</span>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'am', label: 'አማርኛ' },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm">{t('acc.theme')}</span>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: t('acc.dark'), icon: <Moon className="size-3.5" /> },
              { value: 'light', label: t('acc.light'), icon: <Sun className="size-3.5" /> },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <span>
            <span className="block text-sm">{t('data.title')}</span>
            <span className="block text-xs text-steel">{t('data.hint')}</span>
          </span>
          <Segmented
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </div>
        {install.mode !== 'none' && (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block text-sm">{t('app.install')}</span>
              <span className="block text-xs text-steel">{install.mode === 'ios' ? t('app.iosHint') : t('app.installHint')}</span>
            </span>
            {install.mode === 'prompt' && (
              <button onClick={() => void install.install()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-camel px-4 text-sm font-semibold text-ink">
                <Download className="size-4" /> {t('app.install')}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Account() {
  const { t } = useT();
  const { token, user, status, signOut } = useCustomer();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const savedCount = useWishlist((s) => s.ids.length);

  if (status === 'loading') return <PageLoader />;

  if (!token || !user) {
    return (
      <div className="mx-auto max-w-md px-4 pt-6 md:pt-10">
        <h1 className="display text-[2rem]">{t('acc.title')}</h1>
        <div className="mt-2">
          <TelegramLogin />
        </div>
        <div className="mt-8">
          <Preferences />
        </div>
      </div>
    );
  }

  const leave = () => {
    const done = () => {
      signOut();
      qc.clear();
      toast.ok(t('acc.signedOut'));
      navigate('/', { replace: true });
    };
    if (tg) tg.showConfirm(t('acc.signOutConfirm'), (ok) => ok && done());
    else if (window.confirm(t('acc.signOutConfirm'))) done();
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-6 md:pt-10">
      <h1 className="display text-[2rem]">{t('acc.title')}</h1>

      {/* Profile */}
      <div className="mt-6 flex items-center gap-4 rounded-3xl border border-seam bg-[radial-gradient(120%_120%_at_0%_0%,rgba(185,139,87,0.14),transparent_55%)] p-5">
        <Avatar user={user} className="size-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-medium">{user.fullName}</p>
          {user.telegramUsername && <p className="truncate text-sm text-camel">@{user.telegramUsername}</p>}
          <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs text-steel">
            <Phone className="size-3.5" /> {user.phone ?? t('acc.noPhone')}
          </p>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-steel">
        <Send className="size-3.5" /> {t('acc.viaTelegram')}
      </p>

      <RewardsCard className="mt-6" />

      <Link to="/orders" className="mt-6 flex items-center gap-4 rounded-2xl border border-seam/80 bg-wool px-4 py-4 transition-colors hover:border-steel">
        <ReceiptText className="size-5 text-camel" />
        <span className="flex-1">{t('acc.orders')}</span>
        <ChevronRight className="size-4 text-steel" />
      </Link>

      <Link to="/saved" className="mt-3 flex items-center gap-4 rounded-2xl border border-seam/80 bg-wool px-4 py-4 transition-colors hover:border-steel">
        <Heart className="size-5 text-camel" />
        <span className="flex-1">{t('saved.title')}</span>
        <span className="font-mono text-sm text-steel">{savedCount || ''}</span>
        <ChevronRight className="size-4 text-steel" />
      </Link>

      <NewsToggle className="mt-3" />

      <div className="mt-8">
        <Preferences />
      </div>

      {/* Inside Telegram the account IS the Telegram account (it signs straight back in), so no sign-out there */}
      {isMiniApp ? (
        <p className="mt-8 text-center text-xs text-steel">{t('acc.viaTelegramApp')}</p>
      ) : (
      <button
        onClick={leave}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-seam py-3.5 text-sm text-danger transition-colors hover:border-danger/60"
      >
        <LogOut className="size-4" /> {t('acc.signOut')}
      </button>
      )}
    </div>
  );
}
