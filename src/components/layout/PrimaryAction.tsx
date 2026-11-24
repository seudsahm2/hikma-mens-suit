import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../ui';
import { tg, usesNativeButton } from '../../lib/telegram';

interface Props {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Extra content shown left of the button on the web (e.g. total). */
  aside?: ReactNode;
}

/**
 * The page's single main action.
 * Inside Telegram it drives the native MainButton; on the web it's a sticky bar.
 */
export function PrimaryAction({ label, onClick, disabled, loading, aside }: Props) {
  const handler = useRef(onClick);
  handler.current = onClick;

  useEffect(() => {
    if (!tg || !usesNativeButton) return;
    const mb = tg.MainButton;
    const cb = () => handler.current();
    mb.onClick(cb);
    return () => {
      mb.offClick(cb);
      mb.hideProgress();
      mb.hide();
    };
  }, []);

  useEffect(() => {
    if (!tg || !usesNativeButton) return;
    const mb = tg.MainButton;
    mb.setParams({ text: label, color: '#B98B57', text_color: '#0D1015', is_visible: true, is_active: !disabled && !loading });
    if (loading) mb.showProgress(false);
    else mb.hideProgress();
  }, [label, disabled, loading]);

  if (usesNativeButton) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-seam bg-ink/90 px-4 py-3 backdrop-blur-md md:bottom-0">
      <div className="mx-auto flex max-w-3xl items-center gap-4">
        {aside && <div className="min-w-0 flex-1">{aside}</div>}
        <Button variant="accent" size="lg" onClick={onClick} disabled={disabled} loading={loading} className={aside ? 'flex-1' : 'w-full'}>
          {label}
        </Button>
      </div>
    </div>
  );
}

/** Shows Telegram's back arrow on inner pages. */
export function useTelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!tg) return;
    const button = tg.BackButton;
    const root = ['/', '/shop', '/bag', '/orders'].includes(location.pathname);
    const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));
    if (root) button.hide();
    else button.show();
    button.onClick(back);
    return () => button.offClick(back);
  }, [location.pathname, navigate]);
}
