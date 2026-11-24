import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Phone told us it's on a slow or metered connection (Android Chrome "Lite mode", 2G/3G). */
function connectionIsSlow() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType ?? '')));
}

/**
 * Data saver: smaller photos and no autoplay video. On automatically on slow connections,
 * and the customer can switch it on or off in Account.
 */
interface DataSaverState {
  choice: 'auto' | 'on' | 'off';
  setChoice: (c: 'auto' | 'on' | 'off') => void;
}
export const useDataSaverStore = create<DataSaverState>()(
  persist((set) => ({ choice: 'auto', setChoice: (choice) => set({ choice }) }), { name: 'hikma-data-saver', version: 1 }),
);
export function useDataSaver() {
  const choice = useDataSaverStore((s) => s.choice);
  return choice === 'on' || (choice === 'auto' && connectionIsSlow());
}
