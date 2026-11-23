import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { Check, AlertCircle } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone']) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = 'ok') => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800);
  },
}));

export const toast = {
  ok: (m: string) => useToasts.getState().push(m, 'ok'),
  error: (m: string) => useToasts.getState().push(m, 'error'),
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex items-center gap-2 rounded-full border border-seam bg-wool-2/95 px-4 py-2.5 text-sm shadow-2xl shadow-black/40 backdrop-blur"
          >
            {t.tone === 'ok' ? <Check className="size-4 text-camel" /> : <AlertCircle className="size-4 text-danger" />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
