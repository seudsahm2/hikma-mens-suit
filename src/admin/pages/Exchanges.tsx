import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, X } from 'lucide-react';
import { Button, PageLoader } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/format';
import { adminApi, PageHeader, Tabs } from '../ui';

interface Ex {
  id: string;
  orderId: string;
  items: { orderItemId: string; name: string; size: string; wantSize: string | null }[];
  reason: 'too_small' | 'too_big' | 'defect' | 'other';
  note: string | null;
  status: 'requested' | 'approved' | 'declined' | 'done';
  staffNote: string | null;
  createdAt: string;
  order: { orderNumber: string; customerName: string; customerPhone: string };
}

const REASON = { too_small: 'Too small', too_big: 'Too big', defect: 'Defect / damage', other: 'Other' };
const STATUS = {
  requested: { label: 'Waiting for you', tone: 'text-camel' },
  approved: { label: 'Approved — waiting for the item', tone: 'text-ok' },
  declined: { label: 'Declined', tone: 'text-steel' },
  done: { label: 'Done', tone: 'text-steel' },
};

/** Size exchanges asked for by customers (within the exchange window after receiving an order). */
export default function Exchanges() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'requested' | 'approved' | 'all'>('requested');
  const q = useQuery({
    queryKey: ['admin', 'exchanges', tab],
    queryFn: () => adminApi<{ requests: Ex[]; open: number }>('/exchanges', { query: { status: tab === 'all' ? undefined : tab } }),
  });
  const decide = useMutation({
    mutationFn: ({ id, status, staffNote }: { id: string; status: 'approved' | 'declined' | 'done'; staffNote?: string }) =>
      adminApi(`/exchanges/${id}`, { method: 'PATCH', body: { status, staffNote } }),
    onSuccess: () => {
      toast.ok('Saved — the customer gets a Telegram message');
      void qc.invalidateQueries({ queryKey: ['admin', 'exchanges'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'exchange-badge'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });
  const ask = (id: string, status: 'approved' | 'declined') => {
    const note = window.prompt(status === 'approved' ? 'Message to the customer (optional), e.g. “Bring it to the shop”:' : 'Reason (optional):', '');
    if (note === null) return;
    decide.mutate({ id, status, staffNote: note || undefined });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Exchanges" kicker="Wrong size? Customers ask here" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'requested', label: 'Waiting', count: q.data?.open },
          { value: 'approved', label: 'Approved' },
          { value: 'all', label: 'All' },
        ]}
      />
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.requests.length ? (
        <p className="py-16 text-center text-sm text-steel">Nothing here.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {q.data.requests.map((e) => (
            <li key={e.id} className="rounded-2xl border border-seam/80 bg-wool p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/admin/orders/${e.orderId}`} className="font-mono text-sm hover:text-camel">
                  {e.order.orderNumber}
                </Link>
                <span className={cn('text-xs', STATUS[e.status].tone)}>{STATUS[e.status].label}</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {e.items.map((i) => (
                  <li key={i.orderItemId} className="flex items-center gap-2">
                    <RefreshCw className="size-3.5 text-camel" />
                    {i.name}
                    <span className="font-mono text-steel">{i.size}</span>
                    {i.wantSize && (
                      <>
                        →<span className="font-mono font-semibold">{i.wantSize}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-steel">
                {REASON[e.reason]}
                {e.note ? ` · “${e.note}”` : ''}
              </p>
              {e.staffNote && <p className="mt-1 text-xs text-chalk/70">You: {e.staffNote}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-steel">
                  {e.order.customerName} · {e.order.customerPhone} · {formatDateTime(e.createdAt)}
                </span>
                <div className="flex gap-2">
                  {e.status === 'requested' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => ask(e.id, 'declined')}>
                        <X className="size-4" /> Decline
                      </Button>
                      <Button size="sm" variant="accent" onClick={() => ask(e.id, 'approved')}>
                        <Check className="size-4" /> Approve
                      </Button>
                    </>
                  )}
                  {e.status === 'approved' && (
                    <Button size="sm" variant="primary" onClick={() => decide.mutate({ id: e.id, status: 'done' })}>
                      Mark exchanged
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-xs text-steel">
        After exchanging, update stock on the product page (the returned size back, the new size out).
      </p>
    </div>
  );
}
