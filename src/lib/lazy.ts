import { lazy, type ComponentType } from 'react';

/**
 * After a new deploy, a page that was already open still points to the OLD code files, which no
 * longer exist ("Failed to fetch dynamically imported module"). When that happens we reload once to
 * pick up the new version. A short-lived flag prevents a reload loop if the file is really missing.
 */
const FLAG = 'hikma-reloaded-for-update';

export function reloadForUpdate(): boolean {
  try {
    const last = Number(sessionStorage.getItem(FLAG) || 0);
    if (Date.now() - last < 30_000) return false; // already tried just now: show the error instead
    sessionStorage.setItem(FLAG, String(Date.now()));
  } catch {
    /* storage blocked: still try once */
  }
  window.location.reload();
  return true;
}

export const isChunkError = (err: unknown) =>
  err instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk/i.test(err.message);

export function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((err) => {
      if (isChunkError(err) && reloadForUpdate()) return new Promise<never>(() => undefined); // page is reloading
      throw err;
    }),
  );
}

/** Vite's own signal that a preloaded file failed (same cause). */
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadForUpdate()) e.preventDefault();
  });
}
