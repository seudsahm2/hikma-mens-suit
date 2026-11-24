import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, configureApi } from '../lib/api';
import { isMiniApp, tg } from '../lib/telegram';
import type { User } from '../lib/types';

interface Session {
  token: string | null;
  user: User | null;
}

interface CustomerAuth extends Session {
  status: 'idle' | 'loading' | 'ready';
  setSession: (s: Session) => void;
  signOut: () => void;
  /** Runs once on app start: Mini App silent sign-in, and renewal of a saved session. */
  bootstrap: () => Promise<void>;
}

let bootstrapping: Promise<void> | null = null;

/**
 * Customers sign in with Telegram only. The session (a 60-day token) is saved in localStorage and
 * renewed on every app start (GET /auth/me), so people who keep using the shop stay signed in.
 * It is only cleared when the server rejects the token (401 on an authenticated request).
 */
export const useCustomer = create<CustomerAuth>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      status: 'idle',
      setSession: ({ token, user }) => set({ token, user, status: 'ready' }),
      signOut: () => set({ token: null, user: null }),
      bootstrap: () => {
        bootstrapping ??= (async () => {
          const hasSaved = Boolean(get().token);
          // Someone with a saved session is "ready" immediately; only show a spinner when we truly don't know yet
          set({ status: hasSaved ? 'ready' : isMiniApp ? 'loading' : 'ready' });

          // Mini App: Telegram tells us who this is — always prefer that (also handles switching Telegram accounts)
          if (isMiniApp && tg) {
            try {
              const res = await api<{ token: string; user: User }>('/auth/telegram/miniapp', { body: { initData: tg.initData } });
              set({ token: res.token, user: res.user, status: 'ready' });
              return;
            } catch {
              /* fall through to the saved session */
            }
          }

          // Renew a saved session. A 401 here signs out automatically (see lib/api); network errors keep it.
          if (get().token) {
            try {
              const res = await api<{ token?: string; user: User }>('/auth/me');
              set({ user: res.user, ...(res.token ? { token: res.token } : {}) });
            } catch {
              /* offline or server asleep: keep the saved session */
            }
          }
          set({ status: 'ready' });
        })();
        return bootstrapping;
      },
    }),
    { name: 'hikma-customer', partialize: (s) => ({ token: s.token, user: s.user }) },
  ),
);

interface StaffAuth extends Session {
  setSession: (s: Session) => void;
  signOut: () => void;
}

/** Owner / admins (phone + password). Kept apart from the customer session. */
export const useStaff = create<StaffAuth>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      signOut: () => set({ token: null, user: null }),
    }),
    { name: 'hikma-staff' },
  ),
);

configureApi({
  getToken: (kind) => (kind === 'staff' ? useStaff.getState().token : useCustomer.getState().token),
  onUnauthorized: (kind) => (kind === 'staff' ? useStaff.getState().signOut() : useCustomer.getState().signOut()),
});
