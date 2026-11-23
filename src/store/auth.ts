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
  /** Mini App: silent sign-in from Telegram initData. */
  bootstrap: () => Promise<void>;
}

/** Customers sign in with Telegram only. */
export const useCustomer = create<CustomerAuth>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      status: 'idle',
      setSession: ({ token, user }) => set({ token, user, status: 'ready' }),
      signOut: () => set({ token: null, user: null }),
      bootstrap: async () => {
        if (get().status === 'loading') return;
        if (!isMiniApp || !tg) {
          set({ status: 'ready' });
          return;
        }
        set({ status: 'loading' });
        try {
          const res = await api<{ token: string; user: User }>('/auth/telegram/miniapp', { body: { initData: tg.initData } });
          set({ token: res.token, user: res.user, status: 'ready' });
        } catch {
          set({ status: 'ready' });
        }
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
