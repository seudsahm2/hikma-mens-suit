import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Film,
  Landmark,
  Megaphone,
  Moon,
  Plus,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Upload,
  Wallet,
} from 'lucide-react';
import { Button, Input, PageLoader, Sheet, Textarea } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { birr, cn } from '../../lib/format';
import type { StoreSettings } from '../../lib/types';
import { adminApi } from '../ui';

// ─── Types ───────────────────────────────────────────────

interface PaymentMethodRow {
  id: string;
  name: string;
  kind: 'wallet' | 'bank' | 'cash';
  accountName: string;
  accountNumber: string;
  isEnabled: boolean;
  sortOrder: number;
}
interface DeliveryRow {
  id: string;
  nameEn: string;
  nameAm: string;
  noteEn: string;
  noteAm: string;
  fee: number | null;
  isEnabled: boolean;
  sortOrder: number;
}
type AllSettings = StoreSettings & {
  channelChatId: string | null;
  adminChatId: string | null;
  channelAutoImport: boolean;
  dailyReport: boolean;
  reportHour: number;
  bagReminders: boolean;
  autoVerifyPayments: boolean;
  paymentVerifyKeySet: boolean;
  paymentVerifyServerKey: boolean;
  autoVerifyMethods: string[];
  exchangeDays: number;
};
interface SettingsResponse {
  settings: AllSettings;
  paymentMethods: PaymentMethodRow[];
  deliveryOptions: DeliveryRow[];
  telegram: { botConfigured: boolean; botUsername: string };
}

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong');

/** Saves one or more settings right away (no separate Save button). */
function usePatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<AllSettings>) => adminApi('/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast.ok('Saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (err) => toast.error(errMsg(err)),
  });
}

// ─── Building blocks ─────────────────────────────────────

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40', checked ? 'bg-camel' : 'bg-seam')}
    >
      <span className={cn('absolute left-0 top-1 size-5 rounded-full bg-chalk shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

function Group({ title, note, children }: { title?: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="label mb-2.5 px-1">{title}</h2>}
      <div className="overflow-hidden rounded-2xl border border-seam/80 bg-gradient-to-b from-wool-2/60 to-wool">
        <div className="divide-y divide-seam/60">{children}</div>
      </div>
      {note && <p className="mt-2 px-1 text-xs leading-relaxed text-steel">{note}</p>}
    </section>
  );
}

function Tile({ children, tone = 'steel' }: { children: ReactNode; tone?: 'camel' | 'steel' | 'ok' | 'chalk' }) {
  const tones = { camel: 'bg-camel/15 text-camel', steel: 'bg-steel/15 text-chalk/80', ok: 'bg-ok/15 text-ok', chalk: 'bg-chalk text-ink' };
  return <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold', tones[tone])}>{children}</span>;
}

function Row({ icon, title, desc, right, onClick }: { icon?: ReactNode; title: ReactNode; desc?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem]">{title}</span>
        {desc && <span className="mt-0.5 block text-[0.8rem] leading-snug text-steel">{desc}</span>}
      </span>
      {right}
      {onClick && !right && <ChevronRight className="size-4 shrink-0 text-steel" />}
    </>
  );
  return onClick ? (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
    >
      {body}
    </div>
  ) : (
    <div className="flex items-center gap-4 px-4 py-3.5">{body}</div>
  );
}

function StatusDot({ on, label }: { on: boolean; label: [string, string] }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', on ? 'text-ok' : 'text-steel')}>
      <span className={cn('size-1.5 rounded-full', on ? 'bg-ok' : 'bg-steel/60')} />
      {on ? label[0] : label[1]}
    </span>
  );
}

const initials = (name: string) =>
  name
    .replace(/Bank( of)?|International|Ethiopia/gi, '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || name.slice(0, 2).toUpperCase();

// ─── Payments ────────────────────────────────────────────

function AccountSheet({ method, onClose, onSave, saving }: { method: PaymentMethodRow; onClose: () => void; onSave: (m: PaymentMethodRow) => void; saving: boolean }) {
  const [name, setName] = useState(method.accountName);
  const [number, setNumber] = useState(method.accountNumber);
  const wallet = method.kind === 'wallet';
  return (
    <Sheet
      open
      onClose={onClose}
      title={method.name}
      footer={
        <div className="flex gap-2">
          {method.isEnabled && (
            <Button variant="ghost" onClick={() => onSave({ ...method, isEnabled: false })} className="text-danger">
              Turn off
            </Button>
          )}
          <Button variant="accent" block loading={saving} disabled={!number.trim()} onClick={() => onSave({ ...method, accountName: name.trim(), accountNumber: number.trim(), isEnabled: true })}>
            {method.isEnabled ? 'Save' : 'Turn on'}
          </Button>
        </div>
      }
    >
      <p className="mb-5 text-sm text-steel">Customers see these at checkout and send the money here.</p>
      <div className="space-y-4">
        <Input name="acc-number" label={wallet ? 'Phone number' : 'Account number'} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} className="h-14 font-mono text-lg" autoFocus />
        <Input name="acc-name" label="Name on the account" placeholder="e.g. Hikma Ahmed" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </Sheet>
  );
}

function AddBankSheet({ banks, onPick, onClose }: { banks: PaymentMethodRow[]; onPick: (m: PaymentMethodRow) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = banks.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open onClose={onClose} title="Add a bank">
      <label className="mb-3 flex h-12 items-center gap-2 rounded-xl border border-seam bg-ink/50 px-3 focus-within:border-camel">
        <Search className="size-4 text-steel" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-full flex-1 bg-transparent focus:outline-none" />
      </label>
      <div className="divide-y divide-seam/60">
        {list.map((b) => (
          <Row key={b.id} icon={<Tile>{initials(b.name)}</Tile>} title={b.name} onClick={() => onPick(b)} />
        ))}
      </div>
    </Sheet>
  );
}

function AutoPaySheet({ settings, onClose }: { settings: AllSettings; onClose: () => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState('');
  const hasKey = settings.paymentVerifyKeySet || settings.paymentVerifyServerKey;
  const save = useMutation({
    mutationFn: (body: { enabled: boolean; apiKey?: string }) => adminApi('/settings/payment-verification', { method: 'PUT', body }),
    onSuccess: (_r, body) => {
      setKey('');
      toast.ok(body.enabled ? 'Automatic checking is on' : 'You confirm payments by hand');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  return (
    <Sheet open onClose={onClose} title="Automatic payment check">
      <div className="space-y-5 text-sm">
        <p className="text-steel">
          When on, the transaction number a customer sends is checked with <b className="text-chalk">ShegerPay</b>. Real payments are confirmed by themselves; anything
          else waits for you. Works for {settings.autoVerifyMethods.join(', ')}.
        </p>
        <div className="rounded-2xl border border-seam/80 bg-ink/40">
          <Row
            title={settings.autoVerifyPayments ? 'On' : 'Off — you confirm by hand'}
            desc={hasKey ? (settings.paymentVerifyKeySet ? 'Your key is saved' : 'Using the key set on the server') : 'Add your key below first'}
            right={<Switch checked={settings.autoVerifyPayments} disabled={!hasKey && !key} onChange={(v) => save.mutate({ enabled: v, ...(key ? { apiKey: key } : {}) })} />}
          />
        </div>
        <Input
          name="shegerKey"
          label={settings.paymentVerifyKeySet ? 'Replace your ShegerPay key' : 'Your ShegerPay API key'}
          placeholder="sk_live_…"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="font-mono"
        />
        <div className="flex gap-2">
          <Button variant="primary" disabled={!key.trim()} loading={save.isPending} onClick={() => save.mutate({ enabled: settings.autoVerifyPayments, apiKey: key.trim() })}>
            Save key
          </Button>
          {settings.paymentVerifyKeySet && (
            <Button variant="ghost" onClick={() => window.confirm('Remove the saved key? Automatic checking turns off.') && save.mutate({ enabled: false, apiKey: '' })}>
              Remove key
            </Button>
          )}
        </div>
        <p className="flex gap-2 text-xs text-steel">
          <ShieldCheck className="size-4 shrink-0 text-camel" /> A transaction number already used on another order is never confirmed — it’s flagged for you.
        </p>
      </div>
    </Sheet>
  );
}

function PaymentsTab({ data }: { data: SettingsResponse }) {
  const qc = useQueryClient();
  const patch = usePatch();
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const rows = data.paymentMethods;
  const s = data.settings;

  const saveMethods = useMutation({
    mutationFn: (next: PaymentMethodRow[]) =>
      adminApi('/settings/payment-methods', {
        method: 'PUT',
        body: { methods: next.map(({ id, accountName, accountNumber, isEnabled, sortOrder }) => ({ id, accountName, accountNumber, isEnabled, sortOrder })) },
      }),
    onSuccess: () => {
      toast.ok('Saved');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  const saveOne = (m: PaymentMethodRow) => saveMethods.mutate(rows.map((r) => (r.id === m.id ? m : r)));
  const toggle = (m: PaymentMethodRow, on: boolean) => {
    if (on && m.kind !== 'cash' && !m.accountNumber) return setEditing(m); // needs the number first
    saveOne({ ...m, isEnabled: on });
  };

  const wallets = rows.filter((r) => r.kind === 'wallet');
  const banks = rows.filter((r) => r.kind === 'bank');
  const cash = rows.find((r) => r.kind === 'cash');
  const enabled = rows.filter((r) => r.isEnabled);

  const methodRow = (m: PaymentMethodRow) => (
    <Row
      key={m.id}
      icon={<Tile tone={m.isEnabled ? 'camel' : 'steel'}>{initials(m.name)}</Tile>}
      title={m.name}
      desc={m.isEnabled ? <span className="font-mono">{m.accountNumber}{m.accountName ? ` · ${m.accountName}` : ''}</span> : 'Off'}
      onClick={() => setEditing(m)}
      right={<Switch checked={m.isEnabled} onChange={(v) => toggle(m, v)} />}
    />
  );

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-camel/25 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(185,139,87,0.16),transparent_60%)] p-5">
        <p className="label !text-camel">Customers can pay with</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {enabled.length ? (
            enabled.map((m) => (
              <span key={m.id} className="rounded-full border border-seam bg-ink/50 px-3 py-1.5 text-sm">
                {m.kind === 'cash' ? 'Cash' : m.name}
              </span>
            ))
          ) : (
            <span className="text-sm text-steel">Nothing yet — turn on at least one below.</span>
          )}
        </div>
      </div>

      <Group title="Mobile money">{wallets.map(methodRow)}</Group>

      <Group title="Banks" note="Only the banks you turn on are shown to customers.">
        {banks.filter((b) => b.isEnabled).map(methodRow)}
        <Row icon={<Tile tone="chalk"><Plus className="size-4" /></Tile>} title="Add a bank" onClick={() => setAdding(true)} />
      </Group>

      {cash && (
        <Group>
          <Row
            icon={<Tile tone={cash.isEnabled ? 'camel' : 'steel'}><Banknote className="size-4" /></Tile>}
            title="Cash at the shop or on delivery"
            desc="Customer pays when they receive it"
            right={<Switch checked={cash.isEnabled} onChange={(v) => toggle(cash, v)} />}
          />
        </Group>
      )}

      <Group title="Deposit">
        <Row
          icon={<Tile><Wallet className="size-4" /></Tile>}
          title="Pay part now, rest on delivery"
          desc={s.partialPaymentEnabled ? `Customers can pay ${s.depositPercent}% first` : 'Customers pay the full price'}
          right={<Switch checked={s.partialPaymentEnabled} onChange={(v) => patch.mutate({ partialPaymentEnabled: v })} />}
        />
        {s.partialPaymentEnabled && (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm text-steel">Deposit</span>
            <div className="flex rounded-full border border-seam p-1">
              {[30, 50, 70].map((p) => (
                <button
                  key={p}
                  onClick={() => patch.mutate({ depositPercent: p })}
                  className={cn('h-8 rounded-full px-4 font-mono text-sm transition-colors', s.depositPercent === p ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group title="Advanced">
        <Row
          icon={<Tile tone={s.autoVerifyPayments ? 'ok' : 'steel'}><ShieldCheck className="size-4" /></Tile>}
          title="Automatic payment check"
          desc={s.autoVerifyPayments ? 'On — real payments confirm themselves' : 'Off — you confirm each payment'}
          onClick={() => setAutoPay(true)}
        />
      </Group>

      {editing && <AccountSheet method={editing} onClose={() => setEditing(null)} onSave={saveOne} saving={saveMethods.isPending} />}
      {adding && (
        <AddBankSheet
          banks={banks.filter((b) => !b.isEnabled)}
          onClose={() => setAdding(false)}
          onPick={(b) => {
            setAdding(false);
            setEditing(b);
          }}
        />
      )}
      {autoPay && <AutoPaySheet settings={s} onClose={() => setAutoPay(false)} />}
    </div>
  );
}

// ─── Delivery ────────────────────────────────────────────

const feeText = (d: DeliveryRow) => (d.fee === null ? 'Price by phone' : d.fee === 0 ? 'Free' : birr(d.fee));

function DeliverySheet({ option, onClose, onSave, saving }: { option: DeliveryRow; onClose: () => void; onSave: (d: DeliveryRow) => void; saving: boolean }) {
  const [d, setD] = useState(option);
  const mode = d.fee === null ? 'phone' : d.fee === 0 ? 'free' : 'fixed';
  return (
    <Sheet open onClose={onClose} title={option.nameEn} footer={<Button variant="accent" block loading={saving} onClick={() => onSave(d)}>Save</Button>}>
      <p className="label mb-2">Price</p>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['free', 'Free'],
            ['fixed', 'Fixed price'],
            ['phone', 'By phone'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setD((x) => ({ ...x, fee: m === 'free' ? 0 : m === 'phone' ? null : x.fee || 200 }))}
            className={cn('h-12 rounded-xl border text-sm transition-colors', mode === m ? 'border-chalk bg-chalk text-ink' : 'border-seam text-steel hover:text-chalk')}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'fixed' && (
        <div className="mt-4">
          <Input name="fee" label="Price (ETB)" inputMode="numeric" value={String(d.fee ?? '')} onChange={(e) => setD((x) => ({ ...x, fee: Number(e.target.value.replace(/\D/g, '')) || 0 }))} className="font-mono text-lg" />
        </div>
      )}
      <div className="mt-6 space-y-4">
        <Input name="noteEn" label="Short note for customers" placeholder="e.g. Same day in Addis" value={d.noteEn} onChange={(e) => setD((x) => ({ ...x, noteEn: e.target.value }))} />
        <Input name="noteAm" label="Note in Amharic" value={d.noteAm} onChange={(e) => setD((x) => ({ ...x, noteAm: e.target.value }))} />
      </div>
    </Sheet>
  );
}

function DeliveryTab({ data }: { data: SettingsResponse }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DeliveryRow | null>(null);
  const rows = data.deliveryOptions;
  const save = useMutation({
    mutationFn: (next: DeliveryRow[]) => adminApi('/settings/delivery-options', { method: 'PUT', body: { options: next } }),
    onSuccess: () => {
      toast.ok('Saved');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (err) => toast.error(errMsg(err)),
  });
  const saveOne = (d: DeliveryRow) => save.mutate(rows.map((r) => (r.id === d.id ? d : r)));
  const icon = (id: string) => (id === 'pickup' ? <Store className="size-4" /> : <Truck className="size-4" />);

  return (
    <div className="space-y-8">
      <Group title="How customers get their order" note="Tap an option to change its price or note.">
        {rows.map((d) => (
          <Row
            key={d.id}
            icon={<Tile tone={d.isEnabled ? 'camel' : 'steel'}>{icon(d.id)}</Tile>}
            title={d.nameEn}
            desc={d.isEnabled ? [feeText(d), /free|phone/i.test(d.noteEn) ? '' : d.noteEn].filter(Boolean).join(' · ') : 'Off'}
            onClick={() => setEditing(d)}
            right={<Switch checked={d.isEnabled} onChange={(v) => saveOne({ ...d, isEnabled: v })} />}
          />
        ))}
      </Group>
      {editing && <DeliverySheet option={editing} onClose={() => setEditing(null)} onSave={saveOne} saving={save.isPending} />}
    </div>
  );
}

// ─── Telegram ────────────────────────────────────────────

function ConnectSheet({ purpose, bot, onClose }: { purpose: 'admin' | 'channel'; bot: string; onClose: () => void }) {
  const qc = useQueryClient();
  const code = useQuery({
    queryKey: ['admin', 'link-code', purpose],
    queryFn: () => adminApi<{ code: string }>('/settings/telegram-link', { body: { purpose } }).then((r) => r.code),
    staleTime: 10 * 60_000,
  });
  const command = code.data ? (purpose === 'admin' ? `/link@${bot} ${code.data}` : `/link ${code.data}`) : '…';
  const steps =
    purpose === 'admin'
      ? [
          <>
            Open{' '}
            <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer" className="text-camel underline underline-offset-2">
              @{bot}
            </a>{' '}
            and tap <b className="text-chalk">Start</b>. (For a staff group: add @{bot} to the group.)
          </>,
          <>Send the message below there.</>,
        ]
      : [
          <>
            In your channel, make @{bot} an <b className="text-chalk">admin</b> with “Post messages”.
          </>,
          <>Post the message below in the channel. The bot removes it and confirms.</>,
        ];
  return (
    <Sheet
      open
      onClose={onClose}
      title={purpose === 'admin' ? 'Connect order alerts' : 'Connect your channel'}
      footer={
        <Button
          variant="accent"
          block
          onClick={() => {
            void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
            onClose();
          }}
        >
          <Check className="size-4" /> I sent it
        </Button>
      }
    >
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-steel">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-camel/15 font-mono text-xs text-camel">{i + 1}</span>
            <span className="pt-1">{s}</span>
          </li>
        ))}
      </ol>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(command);
          toast.ok('Copied');
        }}
        className="mt-6 flex w-full items-center justify-between gap-3 rounded-2xl border border-camel/40 bg-ink px-4 py-4 text-left"
      >
        <span className="truncate font-mono text-base">{command}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-camel">
          <Copy className="size-4" /> Copy
        </span>
      </button>
      <p className="mt-2 text-center text-xs text-steel">Works once, for 15 minutes.</p>
    </Sheet>
  );
}

function TelegramTab({ data }: { data: SettingsResponse }) {
  const patch = usePatch();
  const [connect, setConnect] = useState<'admin' | 'channel' | null>(null);
  const s = data.settings;
  const bot = data.telegram.botUsername;

  if (!data.telegram.botConfigured) {
    return <Group><Row title="The bot isn’t set up on the server yet" desc="Add the bot token to the server settings, then come back." /></Group>;
  }
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['admin', 'Order alerts', 'New orders arrive with buttons', Bell, Boolean(s.adminChatId)],
            ['channel', 'Your channel', 'Post products in one tap', Send, Boolean(s.channelChatId)],
          ] as const
        ).map(([purpose, title, desc, Icon, on]) => (
          <button
            key={purpose}
            onClick={() => setConnect(purpose)}
            className={cn(
              'group rounded-3xl border p-5 text-left transition-colors',
              on ? 'border-ok/30 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(110,170,130,0.12),transparent_60%)]' : 'border-camel/40 bg-camel/[0.05] hover:border-camel',
            )}
          >
            <div className="flex items-center justify-between">
              <Tile tone={on ? 'ok' : 'camel'}>
                <Icon className="size-4" />
              </Tile>
              <StatusDot on={on} label={['Connected', 'Not connected']} />
            </div>
            <p className="mt-4 text-base">{title}</p>
            <p className="mt-0.5 text-sm text-steel">{desc}</p>
            <p className="mt-3 text-xs text-camel">{on ? 'Change →' : 'Connect →'}</p>
          </button>
        ))}
      </div>

      <Group title="Automatic">
        <Row
          icon={<Tile tone={s.dailyReport ? 'camel' : 'steel'}><Moon className="size-4" /></Tile>}
          title="Evening report"
          desc={s.adminChatId ? 'Today’s sales and what needs you — send /report any time' : 'Connect order alerts first'}
          right={<Switch checked={s.dailyReport} disabled={!s.adminChatId} onChange={(v) => patch.mutate({ dailyReport: v })} />}
        />
        {s.dailyReport && s.adminChatId && (
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-steel">
              <Clock className="size-4" /> Send at
            </span>
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {[19, 20, 21, 22].map((h) => (
                <button
                  key={h}
                  onClick={() => patch.mutate({ reportHour: h })}
                  className={cn('h-8 rounded-full px-3 font-mono text-sm transition-colors', s.reportHour === h ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}
                >
                  {h}:00
                </button>
              ))}
            </div>
          </div>
        )}
        <Row
          icon={<Tile tone={s.bagReminders ? 'camel' : 'steel'}><ShoppingBag className="size-4" /></Tile>}
          title="Bag reminder"
          desc="One friendly message if a customer leaves items in the bag"
          right={<Switch checked={s.bagReminders} onChange={(v) => patch.mutate({ bagReminders: v })} />}
        />
        <Row
          icon={<Tile tone={s.channelAutoImport && s.channelChatId ? 'camel' : 'steel'}><Megaphone className="size-4" /></Tile>}
          title="Channel posts become products"
          desc={s.channelChatId ? 'Post on Telegram as usual — it appears in Products as a draft' : 'Connect your channel first'}
          right={<Switch checked={s.channelAutoImport} disabled={!s.channelChatId} onChange={(v) => patch.mutate({ channelAutoImport: v })} />}
        />
      </Group>

      {connect && <ConnectSheet purpose={connect} bot={bot} onClose={() => setConnect(null)} />}
    </div>
  );
}

// ─── Shop info ───────────────────────────────────────────

const SHOP_FIELDS = [
  'storeName',
  'phone',
  'telegramInbox',
  'telegramChannelUrl',
  'tikTokHandle',
  'addressEn',
  'addressAm',
  'mapLat',
  'mapLng',
  'openingHours',
  'announcementEn',
  'announcementAm',
  'returnPolicyEn',
  'returnPolicyAm',
] as const;
type ShopForm = Pick<StoreSettings, (typeof SHOP_FIELDS)[number]>;
const pickShop = (s: StoreSettings): ShopForm => Object.fromEntries(SHOP_FIELDS.map((k) => [k, s[k]])) as ShopForm;

function Fieldset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="label mb-2.5 px-1">{title}</h2>
      <div className="grid gap-4 rounded-2xl border border-seam/80 bg-gradient-to-b from-wool-2/60 to-wool p-4 sm:grid-cols-2 sm:p-5">{children}</div>
    </section>
  );
}

function ShopTab({ data }: { data: SettingsResponse }) {
  const patch = usePatch();
  const [f, setF] = useState<ShopForm>(() => pickShop(data.settings));
  useEffect(() => setF(pickShop(data.settings)), [data.settings]);
  const set = <K extends keyof ShopForm>(k: K, v: ShopForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(pickShop(data.settings));
  // The pin is typed/pasted as text ("9.01, 38.74"); keep the text so typing isn't interrupted
  const pinOf = (x: ShopForm) => (x.mapLat !== null && x.mapLng !== null ? `${x.mapLat}, ${x.mapLng}` : '');
  const [pin, setPin] = useState(() => pinOf(pickShop(data.settings)));
  useEffect(() => setPin(pinOf(pickShop(data.settings))), [data.settings]);

  return (
    <div className="space-y-8 pb-24">
      <Fieldset title="Contact">
        <Input name="storeName" label="Shop name" value={f.storeName} onChange={(e) => set('storeName', e.target.value)} />
        <Input name="phone" label="Phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <Input name="inbox" label="Telegram username for questions" placeholder="Hikm5506" value={f.telegramInbox} onChange={(e) => set('telegramInbox', e.target.value)} />
        <Input name="tiktok" label="TikTok username" value={f.tikTokHandle} onChange={(e) => set('tikTokHandle', e.target.value)} />
        <Input name="channel" label="Telegram channel link" placeholder="https://t.me/…" value={f.telegramChannelUrl} onChange={(e) => set('telegramChannelUrl', e.target.value)} />
        <Input name="hours" label="Opening hours" value={f.openingHours} onChange={(e) => set('openingHours', e.target.value)} />
      </Fieldset>

      <Fieldset title="Where the shop is">
        <Input name="addressEn" label="Address" value={f.addressEn} onChange={(e) => set('addressEn', e.target.value)} />
        <Input name="addressAm" label="Address in Amharic" value={f.addressAm} onChange={(e) => set('addressAm', e.target.value)} />
        <Input
          name="map"
          label="Map pin"
          placeholder="9.0123, 38.7456"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            const m = e.target.value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
            setF((p) => ({ ...p, mapLat: m ? Number(m[1]) : null, mapLng: m ? Number(m[2]) : null }));
          }}
          hint="Google Maps → press and hold on the shop → tap the numbers to copy → paste here"
        />
      </Fieldset>

      <Fieldset title="Message at the top of the shop">
        <Input name="annEn" label="Message" placeholder="e.g. New Turkish suits just arrived" value={f.announcementEn} onChange={(e) => set('announcementEn', e.target.value)} hint="Leave empty to hide it" />
        <Input name="annAm" label="Message in Amharic" value={f.announcementAm} onChange={(e) => set('announcementAm', e.target.value)} />
      </Fieldset>

      <section>
        <h2 className="label mb-2.5 px-1">Exchange window</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-seam/80 bg-gradient-to-b from-wool-2/60 to-wool px-4 py-3.5">
          <span>
            <span className="block text-sm">Customers can ask for a size exchange</span>
            <span className="block text-xs text-steel">From “My orders”, after they receive the order</span>
          </span>
          <div className="flex rounded-full border border-seam p-1">
            {[0, 3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => patch.mutate({ exchangeDays: d } as Partial<AllSettings>)}
                className={cn('h-8 rounded-full px-3 font-mono text-sm transition-colors', data.settings.exchangeDays === d ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}
              >
                {d === 0 ? 'Off' : `${d} days`}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Fieldset title="Returns & exchange">
        <Textarea name="retEn" label="Policy" rows={5} value={f.returnPolicyEn} onChange={(e) => set('returnPolicyEn', e.target.value)} />
        <Textarea name="retAm" label="Policy in Amharic" rows={5} value={f.returnPolicyAm} onChange={(e) => set('returnPolicyAm', e.target.value)} />
      </Fieldset>

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-seam bg-ink/90 px-4 py-3 backdrop-blur md:left-[248px]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm text-steel">Unsaved changes</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setF(pickShop(data.settings));
                  setPin(pinOf(pickShop(data.settings)));
                }}
              >
                Undo
              </Button>
              <Button variant="accent" loading={patch.isPending} onClick={() => patch.mutate(f)}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Home page ───────────────────────────────────────────

function HomeTab({ data }: { data: SettingsResponse }) {
  const qc = useQueryClient();
  const s = data.settings;
  const [busy, setBusy] = useState<'video' | 'image' | null>(null);
  const upload = async (kind: 'video' | 'image', file?: File) => {
    if (!file) return;
    setBusy(kind);
    try {
      const form = new FormData();
      form.set(kind, file);
      await adminApi(kind === 'video' ? '/settings/hero' : '/settings/hero-image', { form });
      toast.ok('Home page updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['config'] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(null);
    }
  };
  const pick = (kind: 'video' | 'image', label: string, Icon: typeof Film) => (
    <label className={cn('flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-seam px-5 text-sm hover:border-camel', busy && 'pointer-events-none opacity-50')}>
      {busy === kind ? <Upload className="size-4 animate-pulse" /> : <Icon className="size-4" />}
      {busy === kind ? 'Uploading…' : label}
      <input type="file" className="sr-only" accept={kind === 'video' ? 'video/mp4,video/webm' : 'image/*'} onChange={(e) => upload(kind, e.target.files?.[0])} />
    </label>
  );

  return (
    <div className="grid items-start gap-8 md:grid-cols-[260px_1fr]">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[2rem] border-[6px] border-wool-2 bg-ink shadow-2xl">
        {s.heroVideoUrl ? (
          <video src={s.heroVideoUrl} poster={s.heroImageUrl ?? undefined} muted loop autoPlay playsInline className="size-full object-cover" />
        ) : s.heroImageUrl ? (
          <img src={s.heroImageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-xs text-steel">No video yet</div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent p-4 pt-12">
          <p className="display text-lg">Hikma</p>
          <p className="text-[0.65rem] text-steel">How the shop opens</p>
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <h2 className="display text-xl">The first thing customers see</h2>
          <p className="mt-2 text-sm text-steel">A short vertical video, 10–20 seconds, no sound needed (MP4, under 40 MB). The cover photo shows while it loads.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pick('video', s.heroVideoUrl ? 'Replace video' : 'Upload video', Film)}
          {pick('image', s.heroImageUrl ? 'Replace cover photo' : 'Upload cover photo', Upload)}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

const TABS = [
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'shop', label: 'Shop info', icon: Landmark },
  { id: 'home', label: 'Home page', icon: Film },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function SettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi<SettingsResponse>('/settings') });
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'payments') as TabId;
  if (isLoading || !data) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="display text-[1.75rem] md:text-[2.25rem]">Settings</h1>
      <div className="no-scrollbar sticky top-[104px] z-20 -mx-4 mt-5 mb-8 overflow-x-auto bg-ink/90 px-4 py-2 backdrop-blur md:top-0 md:mx-0 md:px-0">
        <div className="flex w-max gap-1 rounded-full border border-seam/80 bg-wool p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setParams({ tab: id }, { replace: true })}
              className={cn('flex h-10 items-center gap-2 rounded-full px-3.5 text-sm transition-colors sm:px-4', tab === id ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}
            >
              <Icon className="size-4" />
              <span className={cn(tab !== id && 'hidden sm:inline')}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {tab === 'payments' && <PaymentsTab data={data} />}
      {tab === 'delivery' && <DeliveryTab data={data} />}
      {tab === 'telegram' && <TelegramTab data={data} />}
      {tab === 'shop' && <ShopTab data={data} />}
      {tab === 'home' && <HomeTab data={data} />}
    </div>
  );
}
