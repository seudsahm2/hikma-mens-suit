import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Search } from 'lucide-react';
import { Button, Empty, ErrorState, PageLoader } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, formatDateTime } from '../../lib/format';
import type { Order, OrderStatus } from '../../lib/types';
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
  const navigate = useNavigate();

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
            {/* Mobile cards — the whole card opens the order; the quick action does the next step */}
            <ul className="space-y-2 md:hidden">
              {data.orders.map((o) => (
                <li
                  key={o.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/orders/${o.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/orders/${o.id}`)}
                  className="cursor-pointer rounded-xl border border-seam bg-wool p-4 transition-colors active:bg-wool-2"
                >
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
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-seam/70 pt-3">
                    <QuickAction order={o} />
                    <span className="inline-flex items-center gap-1 text-xs text-steel">
                      Open <ChevronRight className="size-3.5" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop table — the whole row opens the order */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-seam text-left text-xs text-steel">
                  <th className="py-3 font-normal">Order</th>
                  <th className="font-normal">Customer</th>
                  <th className="font-normal">Items</th>
                  <th className="font-normal">Payment</th>
                  <th className="font-normal">Status</th>
                  <th className="text-right font-normal">Total</th>
                  <th className="w-[1%] font-normal">
                    <span className="sr-only">Next step</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onClick={() => navigate(`/admin/orders/${o.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/orders/${o.id}`)}
                    className="group cursor-pointer border-b border-seam/60 transition-colors hover:bg-wool focus-visible:bg-wool focus-visible:outline-none"
                  >
                    <td className="py-3 pl-2">
                      <span className="font-mono group-hover:text-camel">{o.orderNumber}</span>
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
                    <td>
                      <PaymentBadge status={o.paymentStatus} />
                      <div className="text-xs text-steel">{o.payment.label}</div>
                    </td>
                    <td>
                      <StatusBadge status={o.status} />
                      <div className="mt-0.5 text-xs text-steel">{o.delivery.label}</div>
                    </td>
                    <td className="text-right font-mono">{birr(o.total)}</td>
                    <td className="pl-4 pr-2">
                      <div className="flex items-center justify-end gap-2">
                        <QuickAction order={o} />
                        <ChevronRight className="size-4 text-steel transition-transform group-hover:translate-x-0.5 group-hover:text-chalk" />
                      </div>
                    </td>
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

/** The single next step for an order, right in the list. Everything else is on the order page. */
function nextStep(o: Order): { label: string; run: () => Promise<unknown> } | null {
  if (o.status === 'CANCELLED' || o.status === 'DELIVERED' || o.status === 'PICKED_UP') return null;
  const status = (s: OrderStatus) => () => adminApi(`/orders/${o.id}/status`, { method: 'PATCH', body: { status: s } });
  if (o.paymentStatus === 'SUBMITTED') {
    return { label: 'Confirm payment', run: () => adminApi(`/orders/${o.id}/payment`, { method: 'PATCH', body: { approve: true } }) };
  }
  const paidOrCash = o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIAL' || o.payment.methodId === 'cash';
  const pickup = o.delivery.optionId === 'pickup';
  if (o.status === 'PENDING') return paidOrCash ? { label: 'Confirm', run: status('CONFIRMED') } : null;
  if (o.status === 'CONFIRMED') return { label: 'Packing', run: status('PACKING') };
  if (o.status === 'PACKING')
    return pickup
      ? { label: 'Picked up', run: () => (window.confirm(`Has the customer picked up ${o.orderNumber}?`) ? status('PICKED_UP')() : Promise.reject(new Error('cancelled'))) }
      : { label: 'On the way', run: status('OUT_FOR_DELIVERY') };
  // Delivered is never a one-click action: it's confirmed with the customer's code (driver or order page)
  return null;
}

function QuickAction({ order }: { order: Order }) {
  const qc = useQueryClient();
  const step = nextStep(order);
  const action = useMutation({
    mutationFn: () => step!.run(),
    onSuccess: () => {
      toast.ok(`${order.orderNumber}: ${step!.label.toLowerCase()} ✓`);
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => err instanceof Error && err.message === 'cancelled' ? undefined : toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });
  if (!step) return <span />;
  return (
    <Button
      size="sm"
      variant={order.paymentStatus === 'SUBMITTED' ? 'accent' : 'primary'}
      loading={action.isPending}
      onClick={(e) => {
        e.stopPropagation(); // don't open the order
        action.mutate();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="whitespace-nowrap"
    >
      {step.label}
    </Button>
  );
}
