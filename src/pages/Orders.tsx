import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Check, ChevronRight, ImagePlus } from 'lucide-react';
import { Mark } from '../components/brand/Mark';
import { TelegramLogin } from '../components/layout/TelegramLogin';
import { NewsToggle } from '../components/layout/NewsToggle';
import { RatePurchases } from '../components/product/Trust';
import { DiscountRows, RewardsCard } from '../components/checkout/Offers';
import { ExchangeBlock, ReceiptButton } from '../components/after/After';
import { HelpBlock } from '../components/after/Help';
import { Button, Empty, ErrorState, Input, PageLoader, Price, buttonClass } from '../components/ui';
import { toast } from '../components/ui/toast';
import { useConfig, useMyOrders, useOrder } from '../hooks/queries';
import { api, ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import { birr, cn, formatDate } from '../lib/format';
import { haptic } from '../lib/telegram';
import type { Order, OrderStatus } from '../lib/types';
import { useCustomer } from '../store/auth';

const statusTone = (o: Order) =>
  o.status === 'CANCELLED' ? 'text-steel' : o.paymentStatus === 'REJECTED' ? 'text-danger' : o.status === 'DELIVERED' || o.status === 'PICKED_UP' ? 'text-ok' : 'text-camel';

export function OrdersPage() {
  const { t, lang } = useT();
  const token = useCustomer((s) => s.token);
  const status = useCustomer((s) => s.status);
  const { data, isLoading, error, refetch } = useMyOrders();

  if (status === 'loading') return <PageLoader />;
  if (!token) return <TelegramLogin />;
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState message={t('common.loadError')} onRetry={() => refetch()} retryLabel={t('common.retry')} />;
  if (!data?.length)
    return (
      <Empty
        title={t('orders.empty')}
        action={
          <Link to="/shop" className={buttonClass('primary')}>
            {t('bag.startShopping')}
          </Link>
        }
      />
    );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 md:pt-10">
      <h1 className="display text-[2rem]">{t('orders.title')}</h1>
      <RewardsCard className="mt-6" />
      <RatePurchases className="mt-6" />
      <NewsToggle className="mt-6" />
      <ul className="mt-6 divide-y divide-seam border-y border-seam">
        {data.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.orderNumber}`} className="flex items-center gap-4 py-4">
              <div className="flex -space-x-4">
                {o.items.slice(0, 3).map((i) =>
                  i.image ? (
                    <img key={i.id} src={i.image} alt="" className="aspect-[4/5] w-12 rounded-md border-2 border-ink object-cover" />
                  ) : (
                    <div key={i.id} className="aspect-[4/5] w-12 rounded-md border-2 border-ink bg-wool" />
                  ),
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm">{o.orderNumber}</p>
                <p className="mt-0.5 text-xs text-steel">{formatDate(o.createdAt, lang)}</p>
              </div>
              <div className="text-right">
                <Price value={o.total} className="text-sm" />
                <p className={cn('mt-0.5 text-xs', statusTone(o))}>
                  {o.paymentStatus === 'UNPAID' || o.paymentStatus === 'REJECTED' || o.paymentStatus === 'SUBMITTED'
                    ? o.status === 'CANCELLED'
                      ? t('status.CANCELLED')
                      : t(`pay.${o.paymentStatus}`)
                    : t(`status.${o.status}`)}
                </p>
              </div>
              <ChevronRight className="size-4 text-steel" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

function Timeline({ order }: { order: Order }) {
  const { t } = useT();
  if (order.status === 'CANCELLED') return <p className="font-mono text-sm text-steel">{t('status.CANCELLED')}</p>;
  const pickup = order.delivery.optionId === 'pickup';
  const steps = pickup ? (['PENDING', 'CONFIRMED', 'PACKING', 'PICKED_UP'] as OrderStatus[]) : FLOW;
  const current = steps.indexOf(order.status);
  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s} className="relative flex flex-col items-center gap-2 text-center">
            {i > 0 && <span className={cn('absolute right-1/2 top-[7px] h-px w-full', i <= current ? 'bg-camel' : 'bg-seam')} aria-hidden />}
            <span className={cn('relative z-10 grid size-[15px] place-items-center rounded-full border', done ? 'border-camel bg-camel' : 'border-seam bg-ink')}>
              {done && <Check className="size-2.5 text-ink" strokeWidth={3} />}
            </span>
            <span className={cn('px-1 text-[0.66rem] leading-tight', i === current ? 'text-chalk' : 'text-steel')}>{t(`status.${s}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SendProof({ order }: { order: Order }) {
  const { t } = useT();
  const qc = useQueryClient();
  const { data: config } = useConfig();
  const [ref, setRef] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const method = config?.paymentMethods.find((m) => m.id === order.payment.methodId);

  const submit = async () => {
    if (!ref.trim() && !file) return;
    setBusy(true);
    try {
      const form = new FormData();
      if (ref.trim()) form.set('transactionRef', ref.trim());
      if (file) form.set('proof', file);
      const res = await api<{ order: Order }>(`/orders/${order.orderNumber}/payment`, { form });
      qc.setQueryData(['order', order.orderNumber, useCustomer.getState().token], res.order);
      haptic.success();
      toast.ok(t('order.proofSent'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-camel/40 bg-camel/[0.05] p-5">
      <p className="font-medium">{order.paymentStatus === 'REJECTED' ? t('order.resend') : t('order.sendProof')}</p>
      {method && method.kind !== 'cash' && (
        <p className="mt-2 text-sm text-steel">
          {birr(order.amountDue)} → <span className="font-mono text-chalk">{method.accountNumber}</span> · {method.name}
        </p>
      )}
      <div className="mt-4 space-y-3">
        <Input name="ref" placeholder={t('checkout.ref')} value={ref} onChange={(e) => setRef(e.target.value)} className="font-mono uppercase" />
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-seam px-4 py-3 text-sm text-steel">
          <ImagePlus className="size-5" />
          {file ? file.name : t('checkout.screenshot')}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Button variant="accent" block loading={busy} disabled={!ref.trim() && !file} onClick={submit}>
          {t('order.sendProof')}
        </Button>
      </div>
    </div>
  );
}

export function OrderPage() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const { t, lang } = useT();
  const token = useCustomer((s) => s.token);
  const status = useCustomer((s) => s.status);
  const { data: order, isLoading, error } = useOrder(orderNumber);
  const { data: config } = useConfig();
  const justPlaced = params.get('placed') === '1';

  useEffect(() => {
    if (justPlaced) haptic.success();
  }, [justPlaced]);

  if (status === 'loading') return <PageLoader />;
  if (!token) return <TelegramLogin />;
  if (isLoading) return <PageLoader />;
  if (error || !order) return <ErrorState message={t('order.notFound')} />;

  const needsProof =
    order.status !== 'CANCELLED' && order.payment.methodId !== 'cash' && (order.paymentStatus === 'UNPAID' || order.paymentStatus === 'REJECTED');

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 md:pt-10">
      {justPlaced && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex flex-col items-center text-center">
          <Mark draw className="size-20" ring="#B98B57" />
          <h1 className="display mt-6 text-[1.9rem]">{t('order.placed')}</h1>
          <NewsToggle className="mt-6 w-full text-left" />
        </motion.div>
      )}

      <div className="flex items-baseline justify-between">
        <p className="font-mono text-lg">{order.orderNumber}</p>
        <p className="text-xs text-steel">{formatDate(order.createdAt, lang)}</p>
      </div>
      <p className={cn('mt-1 text-sm', statusTone(order))}>{t(`pay.${order.paymentStatus}`)}</p>

      <RatePurchases orderNumber={order.orderNumber} autoOpen={params.get('review') === '1'} className="mt-6" />
      <ExchangeBlock order={order} />
      <HelpBlock order={order} store={config?.store} autoOpen={params.get('help') === '1'} />

      <div className="mt-8">
        <Timeline order={order} />
      </div>

      {needsProof && (
        <div className="mt-8">
          <SendProof order={order} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="label mb-3">{t('order.items')}</h2>
        <ul className="divide-y divide-seam border-y border-seam">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-3">
              {i.image ? <img src={i.image} alt="" className="aspect-[4/5] w-14 rounded-md object-cover" /> : <div className="aspect-[4/5] w-14 rounded-md bg-wool" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.name}</p>
                <p className="mt-0.5 font-mono text-xs text-steel">
                  {[i.size, i.color, `× ${i.quantity}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Price value={i.unitPrice * i.quantity} className="text-sm" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 space-y-2 text-sm">
        {(order.discountTotal ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-steel">{t('bag.subtotal')}</span>
            <Price value={order.subtotal} />
          </div>
        )}
        {(order.discounts?.length || order.giftNote) && <DiscountRows discounts={order.discounts ?? []} giftNote={order.giftNote} />}
        <div className="flex justify-between">
          <span className="text-steel">{t('order.delivery')}</span>
          <span className="text-right">
            {order.delivery.label}
            {order.deliveryFee === null ? ` · ${t('checkout.byPhone')}` : order.deliveryFee > 0 ? ` · ${birr(order.deliveryFee)}` : ''}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-steel">{t('order.payment')}</span>
          <span>{order.payment.label}</span>
        </div>
        <div className="flex justify-between pt-2 text-base">
          <span>{t('checkout.total')}</span>
          <span className="text-right">
            <Price value={order.total} />
            {(order.discountTotal ?? 0) > 0 && <span className="block text-xs text-ok">{t('promo.saved', { n: birr(order.discountTotal!) })}</span>}
          </span>
        </div>
        {order.amountPaid > 0 && (
          <div className="flex justify-between">
            <span className="text-steel">{t('order.paid')}</span>
            <Price value={order.amountPaid} />
          </div>
        )}
        {order.amountPaid > 0 && order.balance > 0 && (
          <div className="flex justify-between text-camel">
            <span>{t('order.balance')}</span>
            <Price value={order.balance} />
          </div>
        )}
      </section>

      <div className="mt-8 flex justify-center">
        <ReceiptButton order={order} store={config?.store} />
      </div>

      <Link to="/shop" className={buttonClass('outline', 'md', 'mt-6 w-full')}>
        {t('order.continueShopping')}
      </Link>
    </div>
  );
}
