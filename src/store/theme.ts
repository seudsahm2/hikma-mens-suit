import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setTelegramChrome } from '../lib/telegram';

export type Theme = 'dark' | 'light';

const COLORS: Record<Theme, string> = { dark: '#0D1015', light: '#F6F3EE' };

/** Applies the theme to the page, the browser bar and (inside Telegram) the Telegram header. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
  setTelegramChrome(COLORS[theme]);
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

/** Dark is the house style; light is one tap away and remembered on this device. */
export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    }),
    { name: 'hikma-theme', onRehydrateStorage: () => (s) => applyTheme(s?.theme ?? 'dark') },
  ),
);
