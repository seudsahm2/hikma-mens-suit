import { useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button, PageLoader } from '../../components/ui';
import { cn, formatDateTime } from '../../lib/format';
import { adminApi, PageHeader } from '../ui';

interface Log {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  summary: string;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
}
interface Page {
  logs: Log[];
  people: { id: string | null; name: string; count: number }[];
  hasMore: boolean;
}

const ICON: Record<string, string> = { order: '🧾', product: '👔', promotion: '🏷', bundle: '✨', settings: '⚙️', staff: '👤', support: '💬', exchange: '🔁', review: '⭐', driver: '🛵', counter: '🏪' };

/** Who did what (owner only). */
export default function Activity() {
  const [actor, setActor] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: ['admin', 'activity', actor],
    queryFn: ({ pageParam }) => adminApi<Page>('/activity', { query: { actor: actor ?? undefined, before: pageParam ?? undefined } }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.logs.at(-1)!.createdAt : undefined),
  });
  const logs = q.data?.pages.flatMap((p) => p.logs) ?? [];
  const people = q.data?.pages[0]?.people ?? [];
  const link = (l: Log) => (l.entity === 'order' && l.entityId ? `/admin/orders/${l.entityId}` : l.entity === 'product' && l.entityId ? `/admin/products/${l.entityId}` : null);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity" kicker="Who did what" />
      <div className="no-scrollbar mb-6 flex gap-1.5 overflow-x-auto">
        <button onClick={() => setActor(null)} className={cn('h-9 shrink-0 rounded-full px-4 text-sm', !actor ? 'bg-chalk text-ink' : 'border border-seam text-steel')}>
          Everyone
        </button>
        {people
          .filter((p) => p.id)
          .map((p) => (
            <button key={p.id} onClick={() => setActor(p.id)} className={cn('h-9 shrink-0 rounded-full px-4 text-sm', actor === p.id ? 'bg-chalk text-ink' : 'border border-seam text-steel')}>
              {p.name} <span className="ml-1 font-mono text-xs opacity-60">{p.count}</span>
            </button>
          ))}
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : !logs.length ? (
        <p className="py-16 text-center text-sm text-steel">Nothing yet — changes made by you and your admins appear here.</p>
      ) : (
        <ol className="relative space-y-1 border-l border-seam pl-5">
          {logs.map((l) => {
            const to = link(l);
            const body = (
              <>
                <span className="mr-2">{ICON[l.entity ?? ''] ?? '•'}</span>
                {l.summary}
              </>
            );
            return (
              <li key={l.id} className="relative py-2">
                <span className="absolute -left-[25px] top-3.5 size-2 rounded-full bg-camel" />
                <p className="text-sm">{to ? <Link to={to} className="hover:text-camel">{body}</Link> : body}</p>
                <p className="text-xs text-steel">
                  {l.actorName} · {formatDateTime(l.createdAt)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {q.hasNextPage && (
        <Button variant="outline" size="sm" className="mt-4" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
          Older
        </Button>
      )}
    </div>
  );
}
