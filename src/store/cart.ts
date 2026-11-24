import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  /** for showing running sales in the bag (older lines may not have it) */
  categorySlug?: string;
  /** pre-order item (deposit now, arrives later) */
  preorder?: boolean;
  name: string;
  image: string | null;
  size: string;
  color: string;
  price: number;
  quantity: number;
  /** Visible stock when added; the server re-checks on order. */
  max: number;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.variantId === line.variantId);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.variantId === line.variantId ? { ...l, ...line, quantity: Math.min(l.quantity + qty, line.max || 20) } : l,
              ),
            };
          }
          return { lines: [{ ...line, quantity: Math.min(qty, line.max || 20) }, ...s.lines] };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(qty, l.max || 20)) } : l)),
        })),
      remove: (variantId) => set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'hikma-bag', version: 1 },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.price * l.quantity, 0);
