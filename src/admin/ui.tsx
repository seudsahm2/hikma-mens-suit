import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import type { Order, OrderStatus, PaymentStatus } from '../lib/types';
import { Dropdown } from '../components/ui/Dropdown';

/** Admin API calls always use the staff session. */
export function adminApi<T>(path: string, opts: Parameters<typeof api>[1] = {}) {
  return api<T>(`/admin${path}`, { ...opts, auth: 'staff' });
}

/** Panel with a soft top light — the base surface of the back office. */
export function Card({ children, className, title, action, flush }: { children: ReactNode; className?: string; title?: string; action?: ReactNode; flush?: boolean }) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-seam/80 bg-gradient-to-b from-wool-2/70 to-wool shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          {title && <h2 className="label !text-chalk/80">{title}</h2>}
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'camel' | 'danger' }) {
  return (
    <div className="rounded-2xl border border-seam/80 bg-wool p-4">
      <p className="label">{label}</p>
      <p className={cn('mt-2 font-mono text-xl tabular-nums md:text-2xl', tone === 'camel' && 'text-camel', tone === 'danger' && 'text-danger')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-steel">{hint}</p>}
    </div>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: 'bg-chalk/[0.07] text-chalk/80 ring-chalk/10',
  CONFIRMED: 'bg-camel/10 text-camel ring-camel/25',
  PACKING: 'bg-camel/10 text-camel ring-camel/25',
  OUT_FOR_DELIVERY: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
  DELIVERED: 'bg-ok/10 text-ok ring-ok/25',
  PICKED_UP: 'bg-ok/10 text-ok ring-ok/25',
  CANCELLED: 'bg-transparent text-steel ring-seam line-through',
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PACKING: 'Packing',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  PICKED_UP: 'Picked up',
  CANCELLED: 'Cancelled',
};
const PAY_STYLE: Record<PaymentStatus, string> = {
  UNPAID: 'text-steel',
  SUBMITTED: 'text-camel',
  PARTIAL: 'text-sky-300',
  PAID: 'text-ok',
  REJECTED: 'text-danger',
};
const PAY_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Not paid',
  SUBMITTED: 'Check payment',
  PARTIAL: 'Deposit paid',
  PAID: 'Paid',
  REJECTED: 'Rejected',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset', STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[0.72rem]', PAY_STYLE[status])}>
      <span className={cn('size-1.5 rounded-full bg-current', status === 'SUBMITTED' && 'animate-pulse')} />
      {PAY_LABEL[status]}
    </span>
  );
}
export const statusLabel = (s: OrderStatus) => STATUS_LABEL[s];

/**
 * Payment state that makes sense for the order: a cancelled order is never "checking payment" —
 * it either owes the customer a refund, was refunded, or had no money involved.
 */
export function OrderPaymentBadge({ order }: { order: Pick<Order, 'status' | 'paymentStatus'> & { refund?: Order['refund'] } }) {
  if (order.status !== 'CANCELLED') return <PaymentBadge status={order.paymentStatus} />;
  if (!order.refund) return <span className="text-[0.72rem] text-steel">No payment</span>;
  return order.refund.due ? (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-danger">
      <span className="size-1.5 animate-pulse rounded-full bg-current" /> Refund due
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-steel">
      <span className="size-1.5 rounded-full bg-current" /> Refunded
    </span>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-steel">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-camel' : 'bg-seam')}
      >
        <span className={cn('absolute left-0 top-0.5 size-5 rounded-full bg-chalk shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Dropdown label={label} value={value} onChange={onChange} options={options} className={className} />
  );
}

export function PageHeader({ title, kicker, action }: { title: string; kicker?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <p className="label mb-2 !text-camel">{kicker}</p>}
        <h1 className="display text-[1.75rem] md:text-[2.25rem]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="inline-flex gap-1 rounded-full border border-seam/80 bg-wool p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex h-8 shrink-0 items-center gap-2 rounded-full px-3.5 text-[0.8rem] transition-colors',
              value === t.value ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk',
            )}
          >
            {t.label}
            {t.count ? <span className={cn('rounded-full px-1.5 font-mono text-[0.62rem]', value === t.value ? 'bg-ink/10' : 'bg-camel text-ink')}>{t.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tape-measure axis (the shop's signature), used under charts. */
export function TapeAxis({ count, labels }: { count: number; labels: (i: number) => string | null }) {
  return (
    <div className="relative mt-2 h-7 rounded-[3px] bg-camel/90 text-ink">
      <div
        className="absolute inset-x-0 top-0 h-[6px]"
        style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(13,16,21,0.5) 0 1px, transparent 1px 6px)' }}
        aria-hidden
      />
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {Array.from({ length: count }, (_, i) => {
          const label = labels(i);
          return (
            <div key={i} className="relative flex justify-center">
              {label !== null && (
                <>
                  <span className="absolute top-0 h-[11px] w-px bg-ink/80" aria-hidden />
                  <span className="absolute bottom-1 font-mono text-[0.58rem] font-medium tabular-nums">{label}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
