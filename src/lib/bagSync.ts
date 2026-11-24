import { useEffect, useState } from 'react';
import { api } from './api';
import { useCustomer } from '../store/auth';
import { useCart, type CartLine } from '../store/cart';

/**
 * Signed-in customers: the bag is also saved on the server, so
 *  - the bag filled on the website is there in the Telegram app (and the other way round)
 *  - the shop can send one reminder if it's left behind.
 * The bag on this device always wins; the saved bag only fills an empty bag.
 */
export function useBagSync() {
  const token = useCustomer((s) => s.token);
  const status = useCustomer((s) => s.status);
  const lines = useCart((s) => s.lines);
  const [readyFor, setReadyFor] = useState<string | null>(null);

  // 1. After sign-in / app start: restore the saved bag into an empty bag
  useEffect(() => {
    if (!token || status !== 'ready' || readyFor === token) return;
    let cancelled = false;
    (async () => {
      if (!useCart.getState().lines.length) {
        try {
          const res = await api<{ lines: CartLine[] }>('/cart');
          if (!cancelled && res.lines.length && !useCart.getState().lines.length) useCart.setState({ lines: res.lines });
        } catch {
          /* offline: the local bag still works */
        }
      }
      if (!cancelled) setReadyFor(token);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, status, readyFor]);

  // 2. Save changes (debounced). Unchanged bags are ignored by the server.
  useEffect(() => {
    if (!token || readyFor !== token) return;
    const timer = setTimeout(() => {
      const items = lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
      api('/cart', { method: 'PUT', body: { items } }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
  }, [lines, token, readyFor]);
}
