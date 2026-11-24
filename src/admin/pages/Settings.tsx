import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Upload } from 'lucide-react';
import { Button, Input, PageLoader, Textarea } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/format';
import type { StoreSettings } from '../../lib/types';
import { adminApi, Card, PageHeader, Toggle } from '../ui';

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
interface SettingsResponse {
  settings: StoreSettings & {
    channelChatId: string | null;
    adminChatId: string | null;
    channelAutoImport: boolean;
    autoVerifyPayments: boolean;
    paymentVerifyKeySet: boolean;
    paymentVerifyServerKey: boolean;
    autoVerifyMethods: string[];
  };
  paymentMethods: PaymentMethodRow[];
  deliveryOptions: DeliveryRow[];
  telegram: { botConfigured: boolean; botUsername: string };
}

const onError = (err: unknown) => toast.error(err instanceof ApiError ? err.message : 'Failed');

function StoreCard({ initial }: { initial: SettingsResponse['settings'] }) {
  const qc = useQueryClient();
  const [s, setS] = useState(initial);
  useEffect(() => setS(initial), [initial]);
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      adminApi('/settings', {
        method: 'PUT',
        body: {
          storeName: s.storeName,
          phone: s.phone,
          telegramInbox: s.telegramInbox,
          telegramChannelUrl: s.telegramChannelUrl,
          tikTokHandle: s.tikTokHandle,
          addressEn: s.addressEn,
          addressAm: s.addressAm,
          mapLat: s.mapLat,
          mapLng: s.mapLng,
          openingHours: s.openingHours,
          announcementEn: s.announcementEn,
          announcementAm: s.announcementAm,
          partialPaymentEnabled: s.partialPaymentEnabled,
          depositPercent: s.depositPercent,
          returnPolicyEn: s.returnPolicyEn,
          returnPolicyAm: s.returnPolicyAm,
        },
      }),
    onSuccess: () => {
      toast.ok('Settings saved');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError,
  });

  return (
    <Card title="Shop details" action={<Button size="sm" variant="accent" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Input name="storeName" label="Shop name" value={s.storeName} onChange={(e) => set('storeName', e.target.value)} />
        <Input name="phone" label="Phone" value={s.phone} onChange={(e) => set('phone', e.target.value)} />
        <Input name="inbox" label="Telegram inbox username" value={s.telegramInbox} onChange={(e) => set('telegramInbox', e.target.value)} />
        <Input name="channel" label="Telegram channel link" value={s.telegramChannelUrl} onChange={(e) => set('telegramChannelUrl', e.target.value)} />
        <Input name="tiktok" label="TikTok username" value={s.tikTokHandle} onChange={(e) => set('tikTokHandle', e.target.value)} />
        <Input name="hours" label="Opening hours" value={s.openingHours} onChange={(e) => set('openingHours', e.target.value)} />
        <Input name="addressEn" label="Address (English)" value={s.addressEn} onChange={(e) => set('addressEn', e.target.value)} />
        <Input name="addressAm" label="Address (Amharic)" value={s.addressAm} onChange={(e) => set('addressAm', e.target.value)} />
        <Input
          name="mapLat"
          label="Map latitude"
          placeholder="9.0xxx"
          value={s.mapLat ?? ''}
          onChange={(e) => set('mapLat', e.target.value ? Number(e.target.value) : null)}
          hint="From Google Maps: long-press the shop → copy the numbers"
        />
        <Input name="mapLng" label="Map longitude" placeholder="38.7xxx" value={s.mapLng ?? ''} onChange={(e) => set('mapLng', e.target.value ? Number(e.target.value) : null)} />
        <Input name="annEn" label="Top banner (English)" value={s.announcementEn} onChange={(e) => set('announcementEn', e.target.value)} hint="Leave empty to hide" />
        <Input name="annAm" label="Top banner (Amharic)" value={s.announcementAm} onChange={(e) => set('announcementAm', e.target.value)} />
      </div>
      <div className="mt-6 border-t border-seam pt-4">
        <Toggle
          checked={s.partialPaymentEnabled}
          onChange={(v) => set('partialPaymentEnabled', v)}
          label="Allow deposit payments"
          hint="Customer pays part now, the rest on delivery"
        />
        {s.partialPaymentEnabled && (
          <Input
            name="deposit"
            label="Deposit (%)"
            inputMode="numeric"
            className="max-w-32"
            value={String(s.depositPercent)}
            onChange={(e) => set('depositPercent', Math.min(90, Math.max(10, Number(e.target.value.replace(/\D/g, '')) || 50)))}
          />
        )}
      </div>
      <div className="mt-6 grid gap-4 border-t border-seam pt-6 md:grid-cols-2">
        <Textarea name="retEn" label="Returns & exchange (English)" rows={4} value={s.returnPolicyEn} onChange={(e) => set('returnPolicyEn', e.target.value)} />
        <Textarea name="retAm" label="Returns & exchange (Amharic)" rows={4} value={s.returnPolicyAm} onChange={(e) => set('returnPolicyAm', e.target.value)} />
      </div>
    </Card>
  );
}

function HeroCard({ settings }: { settings: StoreSettings }) {
  const qc = useQueryClient();
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
      onError(err);
    } finally {
      setBusy(null);
    }
  };
  const clear = useMutation({
    mutationFn: () => adminApi('/settings', { method: 'PUT', body: { heroVideoUrl: null, heroImageUrl: null } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
  });

  return (
    <Card title="Home page video">
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-3 text-sm text-steel">
          <p>A short vertical video (MP4, under 40 MB, 10–20 seconds, no sound needed) plays behind the headline. The cover image shows while it loads.</p>
          <div className="flex flex-wrap gap-2">
            {(['video', 'image'] as const).map((kind) => (
              <label key={kind} className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-seam px-3 text-chalk hover:border-steel', busy && 'pointer-events-none opacity-50')}>
                <Upload className="size-4" />
                {busy === kind ? 'Uploading…' : kind === 'video' ? 'Upload video' : 'Upload cover image'}
                <input type="file" className="sr-only" accept={kind === 'video' ? 'video/mp4,video/webm' : 'image/*'} onChange={(e) => upload(kind, e.target.files?.[0])} />
              </label>
            ))}
            {(settings.heroVideoUrl || settings.heroImageUrl) && (
              <Button variant="ghost" size="sm" onClick={() => clear.mutate()}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <div className="aspect-[9/16] max-h-72 overflow-hidden rounded-lg border border-seam bg-ink">
          {settings.heroVideoUrl ? (
            <video src={settings.heroVideoUrl} poster={settings.heroImageUrl ?? undefined} muted loop autoPlay playsInline className="size-full object-cover" />
          ) : settings.heroImageUrl ? (
            <img src={settings.heroImageUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-xs text-steel">No video yet</div>
          )}
        </div>
      </div>
    </Card>
  );
}

function PaymentsCard({ initial }: { initial: PaymentMethodRow[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState(initial);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setRows(initial), [initial]);
  const update = (id: string, patch: Partial<PaymentMethodRow>) => setRows((r) => r.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const save = useMutation({
    mutationFn: () =>
      adminApi('/settings/payment-methods', {
        method: 'PUT',
        body: { methods: rows.map(({ id, accountName, accountNumber, isEnabled, sortOrder }) => ({ id, accountName, accountNumber, isEnabled, sortOrder })) },
      }),
    onSuccess: () => {
      toast.ok('Payment methods saved');
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError,
  });
  const visible = showAll ? rows : rows.filter((r) => r.isEnabled || r.kind !== 'bank');

  return (
    <Card title="Payment methods" action={<Button size="sm" variant="accent" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
      <p className="mb-4 text-sm text-steel">Turn on every account you accept. Customers see the account number at checkout.</p>
      <ul className="divide-y divide-seam">
        {visible.map((m) => (
          <li key={m.id} className="py-3">
            <Toggle checked={m.isEnabled} onChange={(v) => update(m.id, { isEnabled: v })} label={m.name} />
            {m.isEnabled && m.kind !== 'cash' && (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Input name={`${m.id}-name`} placeholder="Account holder name" value={m.accountName} onChange={(e) => update(m.id, { accountName: e.target.value })} />
                <Input
                  name={`${m.id}-number`}
                  placeholder={m.kind === 'wallet' ? 'Phone number' : 'Account number'}
                  value={m.accountNumber}
                  onChange={(e) => update(m.id, { accountNumber: e.target.value })}
                  className="font-mono"
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {!showAll && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll(true)}>
          Show all banks ({rows.filter((r) => r.kind === 'bank').length})
        </Button>
      )}
    </Card>
  );
}

/** Automatic payment checking (ShegerPay). Off by default — staff confirm payments by hand. */
function AutoPayCard({ settings }: { settings: SettingsResponse['settings'] }) {
  const qc = useQueryClient();
  const [key, setKey] = useState('');
  const hasKey = settings.paymentVerifyKeySet || settings.paymentVerifyServerKey;
  const save = useMutation({
    mutationFn: (body: { enabled: boolean; apiKey?: string }) => adminApi('/settings/payment-verification', { method: 'PUT', body }),
    onSuccess: (_r, body) => {
      setKey('');
      toast.ok(body.enabled ? 'Automatic payment checking is on' : 'Payments are checked by hand');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError,
  });
  return (
    <Card title="Automatic payment checking">
      <p className="text-sm text-steel">
        When on, a customer’s transaction number is checked with <b className="text-chalk">ShegerPay</b> right away: real payments are confirmed
        automatically, anything else waits for you. Use the API key of <b className="text-chalk">your own</b> ShegerPay account. Works for{' '}
        {settings.autoVerifyMethods.join(', ')}; other methods are always checked by hand.
      </p>
      <div className="mt-4 rounded-xl border border-seam/80 bg-ink/40 px-4 py-1">
        <Toggle
          checked={settings.autoVerifyPayments}
          onChange={(v) => save.mutate({ enabled: v, ...(key ? { apiKey: key } : {}) })}
          label={settings.autoVerifyPayments ? 'On — payments are checked automatically' : 'Off — you confirm payments by hand'}
          hint={hasKey ? (settings.paymentVerifyKeySet ? 'API key saved' : 'Using the key set on the server') : 'Add the API key below first'}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Input
          name="shegerKey"
          label={settings.paymentVerifyKeySet ? 'Replace API key' : 'ShegerPay API key'}
          placeholder="sk_live_…"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="font-mono"
        />
        <Button variant="outline" size="md" disabled={!key.trim()} loading={save.isPending} onClick={() => save.mutate({ enabled: settings.autoVerifyPayments, apiKey: key.trim() })}>
          Save key
        </Button>
        {settings.paymentVerifyKeySet && (
          <Button variant="ghost" size="md" onClick={() => window.confirm('Remove the saved key? Automatic checking will turn off.') && save.mutate({ enabled: false, apiKey: '' })}>
            Remove key
          </Button>
        )}
      </div>
      <p className="mt-3 text-xs text-steel">
        A transaction number already used on another order is never confirmed automatically — it’s flagged for you to check.
      </p>
    </Card>
  );
}

function DeliveryCard({ initial }: { initial: DeliveryRow[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState(initial);
  useEffect(() => setRows(initial), [initial]);
  const update = (id: string, patch: Partial<DeliveryRow>) => setRows((r) => r.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const save = useMutation({
    mutationFn: () => adminApi('/settings/delivery-options', { method: 'PUT', body: { options: rows } }),
    onSuccess: () => {
      toast.ok('Delivery saved');
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError,
  });
  return (
    <Card title="Delivery" action={<Button size="sm" variant="accent" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
      <ul className="divide-y divide-seam">
        {rows.map((d) => (
          <li key={d.id} className="py-3">
            <Toggle checked={d.isEnabled} onChange={(v) => update(d.id, { isEnabled: v })} label={d.nameEn} hint={d.noteEn} />
            {d.isEnabled && (
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <Input
                  name={`${d.id}-fee`}
                  label="Fee (ETB)"
                  inputMode="numeric"
                  placeholder="Empty = by phone"
                  value={d.fee === null ? '' : String(d.fee)}
                  onChange={(e) => update(d.id, { fee: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) })}
                />
                <Input name={`${d.id}-noteEn`} label="Note (English)" value={d.noteEn} onChange={(e) => update(d.id, { noteEn: e.target.value })} />
                <Input name={`${d.id}-noteAm`} label="Note (Amharic)" value={d.noteAm} onChange={(e) => update(d.id, { noteAm: e.target.value })} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TelegramCard({ settings, telegram }: { settings: SettingsResponse['settings']; telegram: SettingsResponse['telegram'] }) {
  const qc = useQueryClient();
  const [code, setCode] = useState<{ purpose: 'admin' | 'channel'; code: string } | null>(null);
  const getCode = useMutation({
    mutationFn: (purpose: 'admin' | 'channel') =>
      adminApi<{ code: string }>('/settings/telegram-link', { body: { purpose } }).then((r) => ({ purpose, code: r.code })),
    onSuccess: setCode,
    onError,
  });
  const autoImport = useMutation({
    mutationFn: (on: boolean) => adminApi('/settings', { method: 'PUT', body: { channelAutoImport: on } }),
    onSuccess: (_r, on) => {
      toast.ok(on ? 'New channel posts will become drafts' : 'Channel auto-import is off');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError,
  });
  const bot = telegram.botUsername;
  const command = code ? (code.purpose === 'admin' ? `/link@${bot} ${code.code}` : `/link ${code.code}`) : '';

  if (!telegram.botConfigured) {
    return (
      <Card title="Telegram">
        <p className="text-sm text-steel">The bot token isn’t set on the server yet.</p>
      </Card>
    );
  }
  return (
    <Card title="Telegram">
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p>
              Order alerts {settings.adminChatId ? <span className="text-ok">· connected</span> : <span className="text-steel">· not connected</span>}
            </p>
            <p className="text-xs text-steel">New orders arrive with buttons to confirm payment and update delivery — in your own chat with the bot, or in a staff group.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => getCode.mutate('admin')} loading={getCode.isPending && getCode.variables === 'admin'}>
            {settings.adminChatId ? 'Change' : 'Connect'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p>
              Channel {settings.channelChatId ? <span className="text-ok">· connected</span> : <span className="text-steel">· not connected</span>}
            </p>
            <p className="text-xs text-steel">Lets you post products to the channel from the product page.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => getCode.mutate('channel')} loading={getCode.isPending && getCode.variables === 'channel'}>
            {settings.channelChatId ? 'Change' : 'Connect'}
          </Button>
        </div>
        {settings.channelChatId && (
          <div className="rounded-xl border border-seam/80 bg-ink/40 px-4 py-1">
            <Toggle
              checked={settings.channelAutoImport}
              onChange={(v) => autoImport.mutate(v)}
              label="New channel posts become drafts"
              hint="Post on Telegram as usual — each new photo post appears in Products → Drafts with its price and photos."
            />
          </div>
        )}

        {code && (
          <div className="rounded-xl border border-camel/40 bg-camel/[0.05] p-4">
            {code.purpose === 'admin' ? (
              <ol className="list-decimal space-y-1.5 pl-5 text-steel">
                <li>
                  <span className="text-chalk">Alerts to you:</span> open{' '}
                  <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer" className="text-camel underline underline-offset-2">
                    @{bot}
                  </a>
                  , tap Start, and send the message below.
                </li>
                <li>
                  <span className="text-chalk">Alerts to a staff group:</span> add @{bot} to the group and send the message below there.
                </li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-1.5 pl-5 text-steel">
                <li>Make @{bot} an admin of the channel, with “Post messages”.</li>
                <li>Post the message below in the channel. The bot removes it and confirms.</li>
              </ol>
            )}
            <button
              onClick={() => {
                void navigator.clipboard.writeText(command);
                toast.ok('Copied');
              }}
              className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-ink px-3 py-2 font-mono text-[0.95rem]"
            >
              <span className="truncate">{command}</span> <Copy className="size-4 shrink-0 text-steel" />
            </button>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-steel">Works once, for 15 minutes.</p>
              <Button variant="ghost" size="sm" onClick={() => void qc.invalidateQueries({ queryKey: ['admin', 'settings'] })}>
                I sent it — check
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi<SettingsResponse>('/settings') });
  if (isLoading || !data) return <PageLoader />;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" />
      <HeroCard settings={data.settings} />
      <PaymentsCard initial={data.paymentMethods} />
      <AutoPayCard settings={data.settings} />
      <DeliveryCard initial={data.deliveryOptions} />
      <TelegramCard settings={data.settings} telegram={data.telegram} />
      <StoreCard initial={data.settings} />
    </div>
  );
}
