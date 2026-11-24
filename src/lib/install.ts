import { useEffect, useState } from 'react';
import { isMiniApp } from './telegram';

/** "Add to home screen": Android/desktop Chrome give us a prompt to show; iPhone needs Share → Add to Home Screen. */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (isMiniApp || standalone()) return { mode: 'none' as const };
  if (deferred) {
    return {
      mode: 'prompt' as const,
      install: async () => {
        const e = deferred;
        deferred = null;
        await e?.prompt();
        force((n) => n + 1);
      },
    };
  }
  return isIos() ? { mode: 'ios' as const } : { mode: 'none' as const };
}
