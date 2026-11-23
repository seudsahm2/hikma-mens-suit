import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button, Empty, ErrorState, PageLoader } from '../../components/ui';
import { birr, formatDateTime } from '../../lib/format';
import type { Order } from '../../lib/types';
import { adminApi, PageHeader, PaymentBadge, StatusBadge, Tabs } from '../ui';

type Tab = 'open' | 'review' | 'all' | 'done' | 'cancelled';

const TAB_QUERY: Record<Tab, Record<string, string>> = {
  open: { status: 'OPEN' },
  review: { payment: 'SUBMITTED' },
  all: {},
  done: { status: 'DELIVERED' },
  cancelled: { status: 'CANCELLED' },
};

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'open';
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => setPage(1), [tab, debounced]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'orders', tab, debounced, page],
    queryFn: () => adminApi<{ orders: Order[]; total: number; hasMore: boolean; needsReview: number }>('/orders', { query: { ...TAB_QUERY[tab], q: debounced, page } }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  return (
    <div>
      <PageHeader title="Orders" />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={tab}
          onChange={(v) => setParams(v === 'open' ? {} : { tab: v })}
          tabs={[
            { value: 'open', label: 'Open' },
            { value: 'review', label: 'Check payment', count: data?.needsReview },
            { value: 'done', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'all', label: 'All' },
          ]}
        />
        <label className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-steel" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Order, name, phone, ref…"
            className="h-10 w-full rounded-full border border-seam bg-wool pl-9 pr-4 text-sm focus:border-camel focus:outline-none"
          />
        </label>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message="Couldn’t load orders." onRetry={() => refetch()} />
      ) : !data?.orders.length ? (
        <Empty title="No orders here." />
      ) : (
        <>
          <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
            {/* Mobile cards */}
            <ul className="space-y-2 md:hidden">
              {data.orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`} className="block rounded-xl border border-seam bg-wool p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{o.orderNumber}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="truncate">{o.customerName}</span>
                      <span className="font-mono">{birr(o.total)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <PaymentBadge status={o.paymentStatus} />
                      <span className="text-xs text-steel">{formatDateTime(o.createdAt)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-seam text-left text-xs text-steel">
                  <th className="py-3 font-normal">Order</th>
                  <th className="font-normal">Customer</th>
                  <th className="font-normal">Items</th>
                  <th className="font-normal">Delivery</th>
                  <th className="font-normal">Payment</th>
                  <th className="font-normal">Status</th>
                  <th className="text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-b border-seam/60 hover:bg-wool">
                    <td className="py-3">
                      <Link to={`/admin/orders/${o.id}`} className="font-mono hover:text-camel">
                        {o.orderNumber}
                      </Link>
                      <div className="text-xs text-steel">{formatDateTime(o.createdAt)}</div>
                    </td>
                    <td>
                      <div>{o.customerName}</div>
                      <div className="font-mono text-xs text-steel">{o.customerPhone}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-3">
                          {o.items.slice(0, 3).map((i) =>
                            i.image ? (
                              <img key={i.id} src={i.image} alt="" className="aspect-[4/5] w-8 rounded border-2 border-ink object-cover" />
                            ) : (
                              <span key={i.id} className="aspect-[4/5] w-8 rounded border-2 border-ink bg-wool-2" />
                            ),
                          )}
                        </div>
                        <span className="font-mono text-xs text-steel">× {o.items.reduce((n, i) => n + i.quantity, 0)}</span>
                      </div>
                    </td>
                    <td className="text-steel">{o.delivery.label}</td>
                    <td>
                      <PaymentBadge status={o.paymentStatus} />
                      <div className="text-xs text-steel">{o.payment.label}</div>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="text-right font-mono">{birr(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="font-mono text-xs text-steel">{data.total} orders</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
