import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { useCustomer } from './auth';

/**
 * Saved items. Works signed out (kept on this device); once signed in, they're merged into the
 * account so they follow the customer and price-drop messages can be sent on Telegram.
 */
interface WishlistState {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => Promise<boolean>;
  setIds: (ids: string[]) => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      has: (id) => get().ids.includes(id),
      setIds: (ids) => set({ ids }),
      toggle: async (id) => {
        const saved = get().ids.includes(id);
        set({ ids: saved ? get().ids.filter((x) => x !== id) : [id, ...get().ids] });
        if (useCustomer.getState().token) {
          try {
            if (saved) await api(`/wishlist/${id}`, { method: 'DELETE' });
            else await api('/wishlist', { body: { productId: id } });
          } catch {
            set({ ids: saved ? [id, ...get().ids] : get().ids.filter((x) => x !== id) }); // undo
            return saved;
          }
        }
        return !saved;
      },
    }),
    { name: 'hikma-saved', version: 1, partialize: (s) => ({ ids: s.ids }) },
  ),
);

/** On sign-in: push this device's saved items to the account, then use the account's list. */
export function useWishlistSync() {
  const token = useCustomer((s) => s.token);
  useEffect(() => {
    if (!token) return;
    const local = useWishlist.getState().ids;
    (async () => {
      try {
        if (local.length) await api('/wishlist/merge', { body: { productIds: local } });
        const r = await api<{ ids: string[] }>('/wishlist');
        useWishlist.getState().setIds(r.ids);
      } catch {
        /* offline: keep the local list */
      }
    })();
  }, [token]);
}
