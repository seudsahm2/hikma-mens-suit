/**
 * Thin, typed wrapper around window.Telegram.WebApp (loaded in index.html).
 * Every helper is a safe no-op in a normal browser.
 */

interface TgButton {
  setText(text: string): TgButton;
  show(): TgButton;
  hide(): TgButton;
  enable(): TgButton;
  disable(): TgButton;
  showProgress(leaveActive?: boolean): TgButton;
  hideProgress(): TgButton;
  setParams(p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): TgButton;
  onClick(cb: () => void): TgButton;
  offClick(cb: () => void): TgButton;
}

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; language_code?: string }; start_param?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  isVersionAtLeast(v: string): boolean;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  disableVerticalSwipes?(): void;
  openLink(url: string, opts?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  requestContact(cb?: (ok: boolean, res?: { responseUnsafe?: { contact?: { phone_number?: string } } }) => void): void;
  showConfirm(message: string, cb: (ok: boolean) => void): void;
  MainButton: TgButton;
  SecondaryButton?: TgButton;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const wa: TgWebApp | undefined = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

/** True only when actually opened inside Telegram (initData is present). */
export const isMiniApp = Boolean(wa && wa.initData);
export const tg = isMiniApp ? wa! : undefined;

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  const ink = '#0D1015';
  try {
    tg.setHeaderColor(ink);
    tg.setBackgroundColor(ink);
    tg.setBottomBarColor?.(ink);
    if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.();
  } catch {
    /* older clients */
  }
  document.documentElement.classList.add('tg');
}

export const startParam = tg?.initDataUnsafe.start_param;
export const telegramLanguage = tg?.initDataUnsafe.user?.language_code;

export const haptic = {
  tap: () => tg?.HapticFeedback.impactOccurred('light'),
  select: () => tg?.HapticFeedback.selectionChanged(),
  success: () => tg?.HapticFeedback.notificationOccurred('success'),
  error: () => tg?.HapticFeedback.notificationOccurred('error'),
};

/** Asks Telegram for the user's phone number (one tap, no typing). */
export function requestPhone(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!tg || !tg.isVersionAtLeast('6.9')) return resolve(null);
    tg.requestContact((ok, res) => {
      const phone = res?.responseUnsafe?.contact?.phone_number;
      resolve(ok && phone ? phone : null);
    });
  });
}

export function openExternal(url: string) {
  if (tg) {
    if (url.startsWith('https://t.me/')) tg.openTelegramLink(url);
    else tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

/** Maps a Mini App start parameter to an in-app path (mirrors the backend). */
export function startParamToPath(param?: string): string | null {
  if (!param) return null;
  if (param.startsWith('p_')) return `/p/${param.slice(2)}`;
  if (param.startsWith('c_')) return `/shop/${param.slice(2)}`;
  if (param.startsWith('o_')) return `/orders/${param.slice(2)}`;
  return null;
}
