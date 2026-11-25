import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { RotateCw } from 'lucide-react';
import { Mark } from '../brand/Mark';
import { isChunkError, reloadForUpdate } from '../../lib/lazy';

/** Friendly screen instead of the raw "Unexpected Application Error". A new version → reload once. */
export function RouteError() {
  const error = useRouteError();
  const update = isChunkError(error);
  useEffect(() => {
    if (update) reloadForUpdate();
  }, [update]);
  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-6 text-center text-chalk">
      <div className="max-w-sm">
        <Mark className="mx-auto size-16" ring="#262C35" />
        <h1 className="display mt-6 text-2xl">{update ? 'Updating…' : 'Something went wrong'}</h1>
        <p className="mt-2 text-sm text-steel">{update ? 'A new version of the shop is ready.' : 'Please reload the page. If it keeps happening, tell us on Telegram.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-camel px-6 font-semibold text-ink"
        >
          <RotateCw className="size-4" /> Reload
        </button>
      </div>
    </div>
  );
}
