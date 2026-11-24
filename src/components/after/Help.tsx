/** "Need help with this order?" — a short conversation with the shop, tied to the order. */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Phone, Send } from 'lucide-react';
import { Button, Sheet } from '../ui';
import { toast } from '../ui/toast';
import { api, ApiError } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { cn } from '../../lib/format';
import { haptic, openExternal } from '../../lib/telegram';
import type { Order, StoreSettings } from '../../lib/types';

interface HelpThread {
  id: string;
  topic: string;
  status: 'open' | 'solved';
  messages: { from: 'customer' | 'staff'; text: string; at: string; by?: string }[];
}
const TOPICS = ['where', 'payment', 'wrong_item', 'damaged', 'other'] as const;

export function HelpBlock({ order, store, autoOpen }: { order: Order; store?: StoreSettings; autoOpen?: boolean }) {
  const { t } = useT();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['help', order.orderNumber],
    queryFn: () => api<{ requests: HelpThread[] }>(`/support/order/${order.orderNumber}`).then((r) => r.requests),
    refetchInterval: (query) => (query.state.data?.[0]?.status === 'open' ? 30_000 : false),
  });
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>('where');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const thread = q.data?.[0];
  const active = thread?.status === 'open' ? thread : null;
  const staffReplied = Boolean(active && active.messages.at(-1)?.from === 'staff');

  const send = async () => {
    setBusy(true);
    try {
      await api('/support', { body: { orderNumber: order.orderNumber, topic: active?.topic ?? topic, text: text.trim() } });
      setText('');
      haptic.success();
      toast.ok(t('help.sent'));
      void qc.invalidateQueries({ queryKey: ['help', order.orderNumber] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('common.loadError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-seam px-4 py-3.5 text-left text-sm transition-colors hover:border-steel">
        <LifeBuoy className="size-4 text-camel" />
        <span className="flex-1">{t('help.button')}</span>
        {active && (
          <span className={cn('rounded-full px-2.5 py-0.5 text-[0.7rem]', staffReplied ? 'bg-ok/15 text-ok' : 'bg-camel/15 text-camel')}>
            {staffReplied ? '💬 1' : t('help.open')}
          </span>
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('help.title', { order: order.orderNumber })}
        footer={
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              placeholder={t('help.placeholder')}
              rows={2}
              className="w-full rounded-xl border border-seam bg-ink/40 px-4 py-3 text-sm focus:border-camel focus:outline-none"
            />
            <Button variant="accent" block loading={busy} disabled={text.trim().length < 2} onClick={send}>
              <Send className="size-4" /> {t('help.send')}
            </Button>
          </div>
        }
      >
        {thread ? (
          <div className="space-y-2">
            {(active ?? thread).messages.map((m, i) => (
              <div key={i} className={cn('flex', m.from === 'customer' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm', m.from === 'customer' ? 'rounded-br-md bg-camel/15' : 'rounded-bl-md border border-seam bg-wool')}>
                  <p className="mb-0.5 text-[0.65rem] text-steel">{m.from === 'customer' ? t('help.you') : (m.by ?? t('help.shop'))}</p>
                  <p className="whitespace-pre-line">{m.text}</p>
                </div>
              </div>
            ))}
            {!active && <p className="pt-2 text-center text-xs text-ok">✓ {t('help.solved')}</p>}
          </div>
        ) : null}

        {!active && (
          <div className={thread ? 'mt-6' : ''}>
            <p className="label mb-2">{t('help.topic')}</p>
            <div className="grid grid-cols-2 gap-2">
              {TOPICS.map((k) => (
                <button
                  key={k}
                  onClick={() => setTopic(k)}
                  className={cn('h-11 rounded-xl border px-2 text-sm transition-colors', topic === k ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel')}
                >
                  {t(`help.${k}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {store && (
          <div className="mt-6 border-t border-seam/60 pt-4">
            <p className="mb-2 text-xs text-steel">{t('help.orCall')}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`tel:${store.phone}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-seam px-4 text-sm">
                <Phone className="size-4" /> {store.phone}
              </a>
              <button
                onClick={() => openExternal(`https://t.me/${store.telegramInbox}?text=${encodeURIComponent(order.orderNumber)}`)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-seam px-4 text-sm"
              >
                <Send className="size-4" /> @{store.telegramInbox}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
