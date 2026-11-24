import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LifeBuoy, Phone, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { Button, PageLoader } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, formatDateTime, timeAgo } from '../../lib/format';
import { adminApi, Tabs } from '../ui';
import Exchanges from './Exchanges';

const TOPIC: Record<string, string> = { where: 'Where is my order?', payment: 'Payment', wrong_item: 'Wrong item', damaged: 'Damaged', other: 'Other' };

interface Thread {
  id: string;
  orderId: string;
  topic: string;
  status: 'open' | 'solved';
  lastFrom: 'customer' | 'staff';
  messages: { from: 'customer' | 'staff'; text: string; at: string; by?: string }[];
  updatedAt: string;
  order: { orderNumber: string; customerName: string; customerPhone: string; status: string; telegramUsername: string | null };
}

function ThreadCard({ th }: { th: Thread }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'support'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'care-badge'] });
  };
  const reply = useMutation({
    mutationFn: (solve: boolean) => adminApi(`/support/${th.id}/reply`, { body: { text: text.trim(), solve } }),
    onSuccess: () => {
      setText('');
      toast.ok('Sent to the customer on Telegram');
      done();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed'),
  });
  const setStatus = useMutation({
    mutationFn: (status: 'open' | 'solved') => adminApi(`/support/${th.id}`, { method: 'PATCH', body: { status } }),
    onSuccess: done,
  });
  const waiting = th.status === 'open' && th.lastFrom === 'customer';

  return (
    <li className={cn('rounded-2xl border bg-wool p-4', waiting ? 'border-camel/50' : 'border-seam/80', th.status === 'solved' && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Link to={`/admin/orders/${th.orderId}`} className="font-mono text-sm hover:text-camel">
            {th.order.orderNumber}
          </Link>
          <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-steel">{TOPIC[th.topic] ?? th.topic}</span>
        </span>
        <span className={cn('text-xs', waiting ? 'text-camel' : th.status === 'solved' ? 'text-ok' : 'text-steel')}>
          {th.status === 'solved' ? '✓ Solved' : waiting ? `Waiting for you · ${timeAgo(th.updatedAt)}` : 'Answered'}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {th.messages.map((m, i) => (
          <div key={i} className={cn('flex', m.from === 'staff' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm', m.from === 'staff' ? 'rounded-br-md bg-camel/15' : 'rounded-bl-md border border-seam bg-ink/40')}>
              <p className="mb-0.5 text-[0.65rem] text-steel">
                {m.from === 'staff' ? (m.by ?? 'Staff') : th.order.customerName} · {formatDateTime(m.at)}
              </p>
              <p className="whitespace-pre-line">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      {th.status === 'open' ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply — the customer gets it on Telegram"
            rows={2}
            className="w-full rounded-xl border border-seam bg-ink/40 px-3 py-2.5 text-sm focus:border-camel focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex gap-1.5">
              <a href={`tel:${th.order.customerPhone}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-seam px-3 text-xs hover:border-steel">
                <Phone className="size-3.5" /> Call
              </a>
              {th.order.telegramUsername && (
                <a href={`https://t.me/${th.order.telegramUsername}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-seam px-3 text-xs hover:border-steel">
                  <Send className="size-3.5" /> @{th.order.telegramUsername}
                </a>
              )}
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate('solved')}>
                <Check className="size-4" /> Solved
              </Button>
              <Button size="sm" variant="outline" disabled={!text.trim()} loading={reply.isPending && reply.variables === true} onClick={() => reply.mutate(true)}>
                Send & solve
              </Button>
              <Button size="sm" variant="accent" disabled={!text.trim()} loading={reply.isPending && reply.variables === false} onClick={() => reply.mutate(false)}>
                <Send className="size-4" /> Send
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate('open')}>
            <RotateCcw className="size-4" /> Reopen
          </Button>
        </div>
      )}
    </li>
  );
}

function HelpTab({ orderId }: { orderId: string | null }) {
  const [status, setStatus] = useState<'open' | 'solved'>('open');
  const q = useQuery({
    queryKey: ['admin', 'support', status, orderId],
    queryFn: () => adminApi<{ requests: Thread[]; open: number }>('/support', { query: orderId ? { order: orderId } : { status } }),
    refetchInterval: 30_000,
  });
  return (
    <div>
      {!orderId && (
        <div className="mb-4 flex gap-1">
          {(['open', 'solved'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn('h-9 rounded-full px-4 text-sm transition-colors', status === s ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}
            >
              {s === 'open' ? `Open${q.data?.open ? ` · ${q.data.open}` : ''}` : 'Solved'}
            </button>
          ))}
        </div>
      )}
      {q.isLoading ? (
        <PageLoader />
      ) : !q.data?.requests.length ? (
        <p className="py-16 text-center text-sm text-steel">{status === 'open' ? 'No open questions. 👌' : 'Nothing solved yet.'}</p>
      ) : (
        <ul className="space-y-3">
          {q.data.requests.map((th) => (
            <ThreadCard key={th.id} th={th} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Everything customers need from the shop after buying: questions about an order, and size exchanges. */
export default function Care() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'exchanges' ? 'exchanges' : 'help';
  const orderId = params.get('order');
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="display mb-6 text-[1.75rem] md:text-[2.25rem]">Customer care</h1>
      <Tabs
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[
          { value: 'help', label: 'Questions' },
          { value: 'exchanges', label: 'Exchanges' },
        ]}
      />
      <div className="mt-6">
        {tab === 'help' ? (
          <>
            {orderId && (
              <p className="mb-4 flex items-center gap-2 text-sm text-steel">
                <LifeBuoy className="size-4 text-camel" /> This order only ·{' '}
                <button onClick={() => setParams({}, { replace: true })} className="text-camel underline underline-offset-2">
                  show all
                </button>
              </p>
            )}
            <HelpTab orderId={orderId} />
          </>
        ) : (
          <Exchanges embedded />
        )}
      </div>
      <p className="mt-8 flex items-center gap-2 text-xs text-steel">
        <RefreshCw className="size-3.5" /> New questions also arrive in your Telegram alerts chat.
      </p>
    </div>
  );
}
