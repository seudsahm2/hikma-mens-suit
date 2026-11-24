import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import type { SizeProfile } from '../lib/types';
import { useCustomer } from './auth';

/**
 * Size memory: the size a customer picked per category, and their height / weight / fit from the
 * size helper. Kept on this device, and on the account when signed in (so it follows them to the
 * Telegram app and is also filled in automatically from their orders).
 */
interface SizeState {
  profile: SizeProfile;
  rememberSize: (categorySlug: string, size: string) => void;
  setBody: (body: Pick<SizeProfile, 'height' | 'weight' | 'fit'>) => void;
}

const saveToAccount = (patch: Partial<SizeProfile>) => {
  if (!useCustomer.getState().token) return;
  api('/auth/me', { method: 'PATCH', body: { sizeProfile: patch } }).catch(() => undefined);
};

export const useSizes = create<SizeState>()(
  persist(
    (set) => ({
      profile: { sizes: {} },
      rememberSize: (categorySlug, size) => {
        set((s) => ({ profile: { ...s.profile, sizes: { ...s.profile.sizes, [categorySlug]: size } } }));
        saveToAccount({ sizes: { [categorySlug]: size } });
      },
      setBody: (body) => {
        set((s) => ({ profile: { ...s.profile, ...body } }));
        saveToAccount(body);
      },
    }),
    { name: 'hikma-sizes', version: 1 },
  ),
);

/** This device's memory, completed by the account's (account fills the gaps, e.g. sizes from past orders). */
export function useSizeProfile(): SizeProfile {
  const local = useSizes((s) => s.profile);
  const account = useCustomer((s) => s.user?.sizeProfile);
  if (!account) return local;
  return {
    height: local.height ?? account.height,
    weight: local.weight ?? account.weight,
    fit: local.fit ?? account.fit,
    sizes: { ...account.sizes, ...local.sizes },
  };
}
