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
  /** Bot API 8.0+: location through Telegram (works where the in-app browser blocks web geolocation). */
  LocationManager?: {
    isInited: boolean;
    isLocationAvailable: boolean;
    isAccessRequested: boolean;
    isAccessGranted: boolean;
    init(cb?: () => void): void;
    getLocation(cb: (data: { latitude: number; longitude: number } | null) => void): void;
    openSettings(): void;
  };
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

/**
 * Telegram's native bottom button feels right on phones. On Telegram Desktop / Web it's a wide bar
 * that doesn't match the site, so there the shop looks and works exactly like the website.
 */
export const usesNativeButton = Boolean(tg && /^(android|ios)/i.test(tg.platform));

/** Telegram header/background colour (follows the shop's light / dark theme). */
export function setTelegramChrome(color: string) {
  if (!tg) return;
  try {
    tg.setHeaderColor(color);
    tg.setBackgroundColor(color);
    tg.setBottomBarColor?.(color);
  } catch {
    /* older clients */
  }
}

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

export type LocationResult =
  | {
      ok: true;
      lat: number;
      lng: number;
      /** metres (null when the source doesn't say) */
      accuracy: number | null;
      /** gps = fresh device reading; telegram = Telegram's stored location (may be old) */
      source: 'gps' | 'telegram';
    }
  | { ok: false; reason: 'denied' | 'unavailable' };

const GOOD_ENOUGH_M = 30; // stop as soon as the reading is this precise
const SETTLE_MS = 8_000; // otherwise take the best reading after this long
const HARD_TIMEOUT_MS = 15_000;

/**
 * A FRESH reading from the device's GPS — never a cached one (maximumAge: 0, high accuracy).
 * The first fix is often rough (Wi-Fi / cell), so we keep listening for a few seconds and keep the
 * most precise reading, stopping early once it's within GOOD_ENOUGH_M.
 */
function freshGps(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ok: false, reason: 'unavailable' });
    let best: GeolocationPosition | null = null;
    let done = false;
    let watchId: number | null = null;
    const finish = (r: LocationResult) => {
      if (done) return;
      done = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(settle);
      clearTimeout(hard);
      resolve(r);
    };
    const fromBest = (): LocationResult =>
      best
        ? { ok: true, lat: +best.coords.latitude.toFixed(6), lng: +best.coords.longitude.toFixed(6), accuracy: Math.round(best.coords.accuracy), source: 'gps' }
        : { ok: false, reason: 'unavailable' };
    const settle = setTimeout(() => best && finish(fromBest()), SETTLE_MS);
    const hard = setTimeout(() => finish(fromBest()), HARD_TIMEOUT_MS);
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
          if (pos.coords.accuracy <= GOOD_ENOUGH_M) finish(fromBest());
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) finish({ ok: false, reason: 'denied' });
          else if (!best && err.code !== err.TIMEOUT) finish({ ok: false, reason: 'unavailable' });
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: HARD_TIMEOUT_MS },
      );
    } catch {
      finish({ ok: false, reason: 'unavailable' });
    }
  });
}

/**
 * Second try from the same (already allowed) browser location: network / Wi-Fi position, may reuse a
 * reading up to 5 minutes old. Used when the GPS couldn't get a satellite fix in time (indoors).
 * No new permission prompt — the browser permission is the same one.
 */
function quickGps(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ok: false, reason: 'unavailable' });
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            ok: true,
            lat: +pos.coords.latitude.toFixed(6),
            lng: +pos.coords.longitude.toFixed(6),
            accuracy: Math.round(pos.coords.accuracy),
            source: 'gps',
          }),
        (err) => resolve({ ok: false, reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
      );
    } catch {
      resolve({ ok: false, reason: 'unavailable' });
    }
  });
}

/** Backup inside Telegram: Telegram's LocationManager (often returns the phone's last stored location). */
function telegramLocation(mayAsk: boolean): Promise<LocationResult> {
  const lm = tg && tg.isVersionAtLeast('8.0') ? tg.LocationManager : undefined;
  if (!lm) return Promise.resolve({ ok: false, reason: 'unavailable' });
  return new Promise((resolve) => {
    const read = () => {
      if (!lm.isLocationAvailable) return resolve({ ok: false, reason: 'unavailable' });
      // Don't show Telegram's own permission prompt unless the browser location can't be used at all
      if (!mayAsk && !lm.isAccessGranted) return resolve({ ok: false, reason: 'unavailable' });
      lm.getLocation((data) => {
        if (data) resolve({ ok: true, lat: +data.latitude.toFixed(6), lng: +data.longitude.toFixed(6), accuracy: null, source: 'telegram' });
        else resolve({ ok: false, reason: lm.isAccessRequested && !lm.isAccessGranted ? 'denied' : 'unavailable' });
      });
    };
    if (lm.isInited) read();
    else lm.init(read);
  });
}

/**
 * The customer's current location, best first:
 *  1. fresh, high-accuracy GPS (one browser permission prompt, then never again);
 *  2. if no satellite fix in time: the same browser location at normal accuracy (no new prompt);
 *  3. Telegram's location — silently if already allowed; it only asks for Telegram permission
 *     when the browser location is missing or was refused (so no second prompt after allowing).
 */
export async function getLocation(): Promise<LocationResult> {
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
  let gps = await freshGps();
  if (gps.ok) return gps;
  if (supported && gps.reason !== 'denied') {
    gps = await quickGps();
    if (gps.ok) return gps;
  }
  if (tg) {
    const backup = await telegramLocation(!supported || gps.reason === 'denied');
    if (backup.ok) return backup;
  }
  return gps;
}

/** Opens Telegram's permission settings for this Mini App (to re-allow location after denying it). */
export function openLocationSettings(): boolean {
  const lm = tg?.LocationManager;
  if (!lm?.isInited) return false;
  lm.openSettings();
  return true;
}

export function openExternal(url: string) {
  if (tg) {
    if (url.startsWith('https://t.me/')) tg.openTelegramLink(url);
    else tg.openLink(url);
  } else {
    // Opening a tab is slow and blocks the page; let the browser paint the tap first, then open it
    // (still within the click's "user activation", so popup blockers allow it).
    requestAnimationFrame(() => setTimeout(() => window.open(url, '_blank', 'noopener'), 0));
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
