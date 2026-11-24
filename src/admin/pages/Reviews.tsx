import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Star } from 'lucide-react';
import { Button, PageLoader } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/format';
import type { Review } from '../../lib/types';
import { adminApi, PageHeader, Tabs } from '../ui';

type AdminReview = Review & { status: 'published' | 'hidden'; product: { id: string; nameEn: string; slug: string }; customer: string };

/** Reviews come only from customers who received the product. Staff can hide one (e.g. abusive) — never edit it. */
export default function Reviews() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'hidden'>('all');
  const q = useQuery({
    queryKey: ['admin', 'reviews', tab],
    queryFn: () => adminApi<{ reviews: AdminReview[]; total: number }>('/reviews', { query: { status: tab === 'hidden' ? 'hidden' : undefined } }),
  });
  const toggle = useMutation({
    mutationFn: (r: AdminReview) => adminApi(`/reviews/${r.id}`, { method: 'PATCH', body: { status: r.status === 'published' ? 'hidden' : 'published' } }),
    onSuccess: (_d, r) => {
      toast.ok(r.status === 'published' ? 'Hidden from the shop' : 'Shown again');
      void qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Reviews" kicker="From real buyers" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: tab === 'all' ? q.data?.total : undefined },
          { value: 'hidden', label: 'Hidden' },
        ]}
      />
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.reviews.length ? (
        <p className="py-16 text-center text-sm text-steel">
          {tab === 'hidden' ? 'Nothing hidden.' : 'No reviews yet. Customers are asked on Telegram a day after they receive their order.'}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {q.data.reviews.map((r) => (
            <li key={r.id} className={cn('rounded-2xl border border-seam/80 bg-wool p-4', r.status === 'hidden' && 'opacity-50')}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn('size-4', i <= r.rating ? 'fill-camel text-camel' : 'text-seam')} />
                  ))}
                </span>
                <Link to={`/admin/products/${r.product.id}`} className="text-sm hover:text-camel">
                  {r.product.nameEn}
                </Link>
                {r.size && <span className="font-mono text-xs text-steel">{r.size}</span>}
              </div>
              {r.text && <p className="mt-2 whitespace-pre-line text-sm text-chalk/85">{r.text}</p>}
              {r.photos.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {r.photos.map((p) => (
                    <a key={p.id} href={p.urls.lg} target="_blank" rel="noreferrer">
                      <img src={p.urls.sm} alt="" className="size-16 rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-steel">
                  {r.customer} · {formatDateTime(r.createdAt)}
                </span>
                <Button variant="ghost" size="sm" loading={toggle.isPending && toggle.variables?.id === r.id} onClick={() => toggle.mutate(r)}>
                  {r.status === 'published' ? (
                    <>
                      <EyeOff className="size-4" /> Hide
                    </>
                  ) : (
                    <>
                      <Eye className="size-4" /> Show
                    </>
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
