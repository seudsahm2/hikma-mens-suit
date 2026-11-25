import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ImagePlus, Loader2, LocateFixed, MapPin, Phone } from 'lucide-react';
import { PrimaryAction } from '../components/layout/PrimaryAction';
import { TelegramLogin } from '../components/layout/TelegramLogin';
import { Input, PageLoader, Price, Textarea } from '../components/ui';
import { toast } from '../components/ui/toast';
import { useConfig } from '../hooks/queries';
import { api, ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import { birr, cn } from '../lib/format';
import { getLocation, haptic, isMiniApp, openLocationSettings, requestPhone } from '../lib/telegram';
import type { Order, PaymentMethodPublic } from '../lib/types';
import { useCustomer } from '../store/auth';
import { cartSubtotal, useCart } from '../store/cart';
import { CodeAndCredit, DiscountRows, forgetInviteCode, savedInviteCode, useQuote } from '../components/checkout/Offers';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-seam py-7">
      <h2 className="label mb-5 !text-chalk">{title}</h2>
      {children}
    </section>
  );
}

function OptionCard({
  selected,
  onClick,
  title,
  subtitle,
  aside,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-colors',
        selected ? 'border-camel bg-camel/[0.06]' : 'border-seam hover:border-steel',
      )}
    >
      <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border', selected ? 'border-camel bg-camel' : 'border-steel/60')}>
        {selected && <Check className="size-3 text-ink" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {subtitle && <span className="mt-0.5 block text-xs text-steel">{subtitle}</span>}
      </span>
      {aside}
    </button>
  );
}

function AccountBox({ method }: { method: PaymentMethodPublic }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(method.accountNumber).catch(() => undefined);
    haptic.tap();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="mt-3 rounded-xl border border-seam bg-ink p-4">
      <p className="label">{t('checkout.sendTo')}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xl tracking-wide tabular-nums">{method.accountNumber}</p>
          <p className="mt-0.5 truncate text-sm text-steel">
            {method.accountName} · {method.name}
          </p>
        </div>
        <button onClick={copy} type="button" className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-seam px-3 text-sm hover:border-steel">
          {copied ? <Check className="size-4 text-camel" /> : <Copy className="size-4" />}
          {copied ? t('checkout.copied') : t('checkout.copy')}
        </button>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { t, pick } = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: config, isLoading } = useConfig();
  const { token, user, status } = useCustomer();
  const { lines, clear } = useCart();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryId, setDeliveryId] = useState('addis');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [fix, setFix] = useState<{ accuracy: number | null; source: 'gps' | 'telegram' } | null>(null);
  const [locating, setLocating] = useState(false);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [deposit, setDeposit] = useState(false);
  const [txRef, setTxRef] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName((n) => n || user.fullName);
    setPhone((p) => p || user.phone || '');
    setArea((a) => a || user.area || '');
    setLandmark((l) => l || user.landmark || '');
  }, [user]);

  useEffect(() => {
    if (config && !methodId) setMethodId(config.paymentMethods.find((m) => m.kind !== 'cash')?.id ?? config.paymentMethods[0]?.id ?? null);
  }, [config, methodId]);

  // Discounts are priced by the server; an invite link pre-fills the code
  const [code, setCode] = useState<string | null>(() => savedInviteCode());
  const [useCredit, setUseCredit] = useState(false);
  const quoteQ = useQuote(lines, code, useCredit);
  const priced = quoteQ.data;

  const proofPreview = useMemo(() => (proof ? URL.createObjectURL(proof) : null), [proof]);
  useEffect(() => () => (proofPreview ? URL.revokeObjectURL(proofPreview) : undefined), [proofPreview]);

  if (!lines.length && !submitting) return <Navigate to="/bag" replace />;
  if (isLoading || !config || status === 'loading') return <PageLoader />;
  if (!token) return <TelegramLogin />;

  const delivery = config.deliveryOptions.find((d) => d.id === deliveryId) ?? config.deliveryOptions[0];
  const method = config.paymentMethods.find((m) => m.id === methodId);
  const isCash = method?.kind === 'cash';
  const subtotal = cartSubtotal(lines);
  const fee = delivery?.fee ?? null;
  const total = (priced?.itemsTotal ?? subtotal) + (fee ?? 0);
  const canDeposit = config.store.partialPaymentEnabled && !isCash;
  const hasPreorder = lines.some((l) => l.preorder);
  const dueNow = canDeposit && (deposit || hasPreorder) ? Math.ceil((total * config.store.depositPercent) / 100) : total;

  const useTelegramPhone = async () => {
    const p = await requestPhone();
    if (p) setPhone(p);
  };

  // Share GPS location, then show the place name and fill the address fields from it
  // Fresh device GPS first (never a cached position); Telegram's stored location only as a backup.
  const addLocation = async () => {
    setLocating(true);
    const loc = await getLocation();
    if (!loc.ok) {
      setLocating(false);
      if (loc.reason === 'denied') {
        toast.error(t('checkout.locationDenied'));
        openLocationSettings(); // inside Telegram: lets the customer re-allow location
      } else {
        toast.error(t('checkout.locationFailed'));
      }
      return;
    }
    const c = { lat: loc.lat, lng: loc.lng };
    setCoords(c);
    setFix({ accuracy: loc.accuracy, source: loc.source });
    setPlaceLabel(null);
    haptic.success();
    try {
      const { place } = await api<{ place: { label: string; area: string | null; landmark: string | null } | null }>('/geo/reverse', {
        query: { lat: c.lat, lng: c.lng },
      });
      if (place) {
        setPlaceLabel(place.label);
        if (place.area) setArea((a) => a || place.area!);
        if (place.landmark) setLandmark((l) => l || place.landmark!);
      }
    } catch {
      /* coordinates are still saved with the order */
    } finally {
      setLocating(false);
    }
  };
  const removeLocation = () => {
    setCoords(null);
    setPlaceLabel(null);
    setFix(null);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = t('checkout.name');
    if (!/^(\+?251|0)?[79]\d{8}$/.test(phone.replace(/[\s-]/g, ''))) e.phone = t('checkout.phone');
    if (delivery?.needsAddress && !area.trim() && !landmark.trim() && !coords) e.area = t('checkout.area');
    if (delivery?.id === 'regional' && !city.trim()) e.city = t('checkout.city');
    if (!method) e.method = t('checkout.payment');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = async () => {
    if (!validate()) {
      haptic.error();
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const { order } = await api<{ order: Order }>('/orders', {
        body: {
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          customerName: name.trim(),
          customerPhone: phone.trim(),
          deliveryOptionId: delivery!.id,
          city: delivery!.id === 'regional' ? city.trim() : delivery!.needsAddress ? 'Addis Ababa' : undefined,
          area: area.trim() || undefined,
          landmark: landmark.trim() || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          paymentMethodId: method!.id,
          payDeposit: canDeposit && (deposit || hasPreorder),
          note: note.trim() || undefined,
          source: isMiniApp ? 'MINI_APP' : 'WEB',
          code: code && priced?.codeApplied ? code : undefined,
          useCredit: useCredit && (priced?.creditUsed ?? 0) > 0,
        },
      });
      if (!isCash && (txRef.trim() || proof)) {
        const form = new FormData();
        if (txRef.trim()) form.set('transactionRef', txRef.trim());
        if (proof) form.set('proof', proof);
        await api(`/orders/${order.orderNumber}/payment`, { form }).catch(() => undefined); // can be resent from the order page
      }
      if (code && priced?.codeApplied) forgetInviteCode();
      clear();
      haptic.success();
      void qc.invalidateQueries({ queryKey: ['my-orders'] });
      navigate(`/orders/${order.orderNumber}?placed=1`, { replace: true });
    } catch (err) {
      haptic.error();
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  const wallets = config.paymentMethods.filter((m) => m.kind === 'wallet');
  const banks = config.paymentMethods.filter((m) => m.kind === 'bank');
  const cash = config.paymentMethods.filter((m) => m.kind === 'cash');

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 md:pt-10">
      <h1 className="display text-[2rem]">{t('checkout.title')}</h1>

      {/* Order summary strip */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {lines.map((l) => (
          <div key={l.variantId} className="relative w-16 shrink-0">
            {l.image ? <img src={l.image} alt={l.name} className="aspect-[4/5] w-full rounded-md object-cover" /> : <div className="aspect-[4/5] rounded-md bg-wool" />}
            {l.quantity > 1 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-chalk font-mono text-[0.6rem] text-ink">{l.quantity}</span>
            )}
          </div>
        ))}
      </div>

      <Section title={t('checkout.details')}>
        <div className="space-y-4">
          <Input name="name" label={t('checkout.name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" error={errors.name && ' '} />
          <div>
            <Input
              name="phone"
              label={t('checkout.phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09…"
              error={errors.phone && ' '}
            />
            {isMiniApp && (
              <button type="button" onClick={useTelegramPhone} className="mt-2 inline-flex items-center gap-2 text-sm text-camel">
                <Phone className="size-4" /> {t('checkout.sharePhone')}
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section title={t('checkout.delivery')}>
        <div className="space-y-2.5">
          {config.deliveryOptions.map((d) => (
            <OptionCard
              key={d.id}
              selected={d.id === delivery?.id}
              onClick={() => setDeliveryId(d.id)}
              title={pick(d.nameEn, d.nameAm)}
              subtitle={pick(d.noteEn, d.noteAm)}
              aside={
                <span className="font-mono text-sm text-steel">{d.fee === null ? t('checkout.byPhone') : d.fee === 0 ? t('common.free') : birr(d.fee)}</span>
              }
            />
          ))}
        </div>
        {delivery?.needsAddress && (
          <div className="mt-5 space-y-4">
            {/* Location first: it fills the fields below */}
            {coords ? (
              <div className="flex items-start gap-3 rounded-xl border border-ok/40 bg-ok/[0.06] p-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-ok" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{locating ? t('checkout.locationLooking') : (placeLabel ?? t('checkout.locationPinned'))}</p>
                  <p className="mt-0.5 font-mono text-[0.7rem] text-steel">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} ·{' '}
                    <a href={`https://maps.google.com/?q=${coords.lat},${coords.lng}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {t('checkout.viewMap')}
                    </a>
                  </p>
                  {fix && !locating && (
                    <p className={cn('mt-1 text-[0.7rem]', fix.source === 'telegram' || (fix.accuracy ?? 0) > 150 ? 'text-camel' : 'text-ok')}>
                      {fix.source === 'telegram'
                        ? t('checkout.locationFromTelegram')
                        : (fix.accuracy ?? 0) > 150
                          ? t('checkout.locationRough', { m: fix.accuracy ?? 0 })
                          : t('checkout.locationPrecise', { m: fix.accuracy ?? 0 })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button type="button" onClick={addLocation} disabled={locating} className="text-xs text-camel underline underline-offset-2 disabled:opacity-50">
                    {t('checkout.locationUpdate')}
                  </button>
                  <button type="button" onClick={removeLocation} className="text-xs text-steel underline underline-offset-2 hover:text-chalk">
                    {t('checkout.removeLocation')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={addLocation}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-camel/60 py-3.5 text-sm text-camel transition-colors hover:bg-camel/[0.06] disabled:opacity-60"
              >
                {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                {locating ? t('checkout.locationLooking') : t('checkout.addLocation')}
              </button>
            )}
            {delivery.id === 'regional' && (
              <Input name="city" label={t('checkout.city')} value={city} onChange={(e) => setCity(e.target.value)} error={errors.city && ' '} />
            )}
            <Input name="area" label={t('checkout.area')} value={area} onChange={(e) => setArea(e.target.value)} error={errors.area && ' '} placeholder="Bole, Kolfe, Piassa…" />
            <Input name="landmark" label={t('checkout.landmark')} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder={t('checkout.landmarkHint')} />
          </div>
        )}
      </Section>

      <Section title={t('checkout.payment')}>
        <div className="space-y-2.5">
          {[...wallets, ...banks, ...cash].map((m) => (
            <div key={m.id}>
              <OptionCard
                selected={m.id === methodId}
                onClick={() => setMethodId(m.id)}
                title={m.name}
                subtitle={m.kind === 'cash' ? t('checkout.cashHint') : undefined}
              />
              {m.id === methodId && m.kind !== 'cash' && <AccountBox method={m} />}
            </div>
          ))}
        </div>

        {canDeposit && hasPreorder && <p className="mt-5 rounded-xl border border-seam px-4 py-3 text-sm text-steel">{t('pre.checkout')}</p>}
        {canDeposit && !hasPreorder && (
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-seam p-1" role="radiogroup">
            {[false, true].map((d) => (
              <button
                key={String(d)}
                type="button"
                role="radio"
                aria-checked={deposit === d}
                onClick={() => setDeposit(d)}
                className={cn('rounded-full px-3 py-2.5 text-sm transition-colors', deposit === d ? 'bg-chalk text-ink' : 'text-steel')}
              >
                {d ? t('checkout.payDeposit', { p: config.store.depositPercent }) : t('checkout.payFull')}
              </button>
            ))}
          </div>
        )}
        {canDeposit && deposit && <p className="mt-2 text-center text-xs text-steel">{t('checkout.payDepositHint')}</p>}

        {!isCash && (
          <div className="mt-6">
            <p className="label mb-1 !text-chalk">{t('checkout.proof')}</p>
            <p className="mb-4 text-xs text-steel">{t('checkout.proofHint')}</p>
            <div className="space-y-3">
              <Input name="txRef" placeholder={t('checkout.ref')} value={txRef} onChange={(e) => setTxRef(e.target.value)} autoCapitalize="characters" className="font-mono uppercase" />
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-seam px-4 py-3 text-sm text-steel hover:border-steel">
                {proofPreview ? <img src={proofPreview} alt="" className="size-10 rounded object-cover" /> : <ImagePlus className="size-5" />}
                {proof ? t('checkout.changeScreenshot') : t('checkout.screenshot')}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
              </label>
              <p className="text-xs text-steel/80">{t('checkout.proofLater')}</p>
            </div>
          </div>
        )}
      </Section>

      <Section title={t('checkout.note')}>
        <Textarea name="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
      </Section>

      <Section title={t('promo.code')}>
        <CodeAndCredit code={code} onCode={setCode} useCredit={useCredit} onUseCredit={setUseCredit} quote={priced} />
      </Section>

      <section className="space-y-2 border-t border-seam py-7 text-sm">
        <div className="flex justify-between">
          <span className="text-steel">{t('bag.subtotal')}</span>
          <Price value={subtotal} />
        </div>
        {priced && <DiscountRows discounts={priced.discounts} giftNote={priced.giftNote} />}
        <div className="flex justify-between">
          <span className="text-steel">{t('checkout.delivery')}</span>
          <span className="font-mono">{fee === null ? t('checkout.byPhone') : fee === 0 ? t('common.free') : birr(fee)}</span>
        </div>
        <div className="flex justify-between pt-2 text-base">
          <span>{t('checkout.total')}</span>
          <Price value={total} />
        </div>
        {dueNow !== total && (
          <div className="flex justify-between text-camel">
            <span>{t('checkout.dueNow')}</span>
            <Price value={dueNow} />
          </div>
        )}
      </section>

      <PrimaryAction
        label={submitting ? t('checkout.placing') : `${t('checkout.place')} · ${birr(isCash ? total : dueNow)}`}
        onClick={placeOrder}
        loading={submitting}
      />
    </div>
  );
}
