/**
 * Discounts & rewards on the shop side. Prices are always calculated by the server
 * (POST /checkout/quote) — this only shows them.
 */
import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Copy, Crown, Gift, Send, Sparkles, Tag, X } from 'lucide-react';
import { Button, Img, Price, Sheet } from '../ui';
import { toast } from '../ui/toast';
import { api } from '../../lib/api';
import { useT } from '../../lib/i18n';
import { birr, cn, sortSizes } from '../../lib/format';
import { haptic, openExternal, startParam } from '../../lib/telegram';
import type { Product } from '../../lib/types';
import { useCart, type CartLine } from '../../store/cart';
import { useCustomer } from '../../store/auth';
import { useSizeProfile } from '../../store/sizes';

// ─── Invite code captured from links (?ref=CODE or Telegram startapp=ref_CODE) ─

const REF_KEY = 'hikma-ref';
export function captureInviteCode() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ref');
    const fromTelegram = startParam?.startsWith('ref_') ? startParam.slice(4) : null;
    const code = (fromUrl || fromTelegram || '').trim().toUpperCase();
    if (/^[A-Z0-9_-]{3,24}$/.test(code)) localStorage.setItem(REF_KEY, code);
  } catch {
    /* storage blocked: invites just won't be pre-filled */
  }
}
export const savedInviteCode = () => {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
};
export const forgetInviteCode = () => {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
};

// ─── Quote ───────────────────────────────────────────────

export interface QuoteResult {
  subtotal: number;
  discounts: { kind: 'bundle' | 'promo' | 'referral' | 'credit'; label: string; amount: number; code?: string }[];
  discountTotal: number;
  itemsTotal: number;
  giftNote: string | null;
  creditUsed: number;
  creditBalance: number;
  codeError: string | null;
  codeApplied: boolean;
  invite: { code: string | null; inviterName: string } | null;
  inviteError: string | null;
}

export function useQuote(lines: CartLine[], code: string | null, useCredit: boolean) {
  const token = useCustomer((s) => s.token);
  const items = useMemo(() => lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), [lines]);
  const invite = savedInviteCode(); // from a friend's link; the account's saved inviter also counts (server side)
  return useQuery({
    queryKey: ['quote', items, code, invite, useCredit, token],
    queryFn: () => api<QuoteResult>('/checkout/quote', { body: { items, code: code || undefined, invite: invite || undefined, useCredit } }),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** Discount rows for a price summary. */
export function DiscountRows({ discounts, giftNote }: { discounts: QuoteResult['discounts']; giftNote?: string | null }) {
  const { t } = useT();
  return (
    <>
      {discounts.map((d, i) => (
        <div key={i} className="flex justify-between text-ok">
          <span className="inline-flex items-center gap-1.5">
            {d.kind === 'credit' ? <Crown className="size-3.5" /> : d.kind === 'bundle' ? <Sparkles className="size-3.5" /> : <Tag className="size-3.5" />}
            {d.kind === 'credit' ? t('rw.credit') : d.label}
            {d.code && <span className="font-mono text-xs opacity-80">{d.code}</span>}
          </span>
          <span className="font-mono">−{birr(d.amount)}</span>
        </div>
      ))}
      {giftNote && (
        <div className="flex justify-between text-camel">
          <span className="inline-flex items-center gap-1.5">
            <Gift className="size-3.5" /> {t('promo.gift')}
          </span>
          <span>{giftNote}</span>
        </div>
      )}
    </>
  );
}

/** Code field + "use my credit" switch. */
export function CodeAndCredit({
  code,
  onCode,
  useCredit,
  onUseCredit,
  quote,
}: {
  code: string | null;
  onCode: (c: string | null) => void;
  useCredit: boolean;
  onUseCredit: (v: boolean) => void;
  quote?: QuoteResult;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState(code ?? '');
  useEffect(() => setDraft(code ?? ''), [code]);
  const applied = Boolean(code && quote?.codeApplied);
  const error = code ? quote?.codeError : null;

  return (
    <div className="space-y-3">
      {applied ? (
        <div className="flex items-center justify-between rounded-xl border border-ok/40 bg-ok/[0.07] px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 text-ok">
            <Check className="size-4" /> {t('promo.applied')} · <span className="font-mono">{code}</span>
          </span>
          <button onClick={() => onCode(null)} className="text-steel hover:text-chalk" aria-label={t('promo.remove')}>
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.toUpperCase().replace(/\s+/g, '').slice(0, 24))}
              onKeyDown={(e) => e.key === 'Enter' && draft && onCode(draft)}
              placeholder={t('promo.code')}
              className={cn(
                'h-12 min-w-0 flex-1 rounded-xl border bg-wool px-4 font-mono uppercase tracking-wider text-chalk placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-steel/60 focus:outline-none',
                error ? 'border-danger/60' : 'border-seam focus:border-camel',
              )}
            />
            <Button variant="outline" disabled={!draft} onClick={() => onCode(draft)}>
              {t('promo.apply')}
            </Button>
          </div>
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
          {quote?.inviteError && <p className="mt-1.5 text-xs text-camel">{quote.inviteError}</p>}
        </div>
      )}
      {(quote?.creditBalance ?? 0) > 0 && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-seam px-4 py-3">
          <span>
            <span className="flex items-center gap-2 text-sm">
              <Crown className="size-4 text-camel" /> {t('promo.credit')}
            </span>
            <span className="mt-0.5 block text-xs text-steel">{t('promo.creditHint', { n: birr(quote!.creditBalance) })}</span>
          </span>
          <input type="checkbox" checked={useCredit} onChange={(e) => onUseCredit(e.target.checked)} className="peer sr-only" />
          <span aria-hidden className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-camel', useCredit ? 'bg-camel' : 'bg-seam')}>
            <span className={cn('absolute left-0 top-1 size-5 rounded-full bg-chalk shadow transition-transform', useCredit ? 'translate-x-6' : 'translate-x-1')} />
          </span>
        </label>
      )}
    </div>
  );
}

// ─── Complete the look ───────────────────────────────────

interface Look {
  id: string;
  name: string;
  nameAm: string | null;
  discountPercent: number;
  products: Product[];
}

export function CompleteTheLook({ product }: { product: Product }) {
  const { t, pick } = useT();
  const q = useQuery({
    queryKey: ['looks', product.slug],
    queryFn: () => api<{ looks: Look[] }>('/looks', { query: { product: product.slug } }).then((r) => r.looks),
    staleTime: 60_000,
  });
  const [open, setOpen] = useState<Look | null>(null);
  const look = q.data?.[0];
  if (!look) return null;
  const full = look.products.reduce((n, p) => n + p.price, 0);
  const together = full - Math.round((full * look.discountPercent) / 100);

  return (
    <section className="mt-16 px-4 md:px-0">
      <div className="overflow-hidden rounded-3xl border border-camel/30 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(185,139,87,0.14),transparent_55%)] p-5 md:p-7">
        <p className="label !text-camel">{t('look.title')}</p>
        <h2 className="display mt-2 text-[1.35rem]">{pick(look.name, look.nameAm)}</h2>
        <div className="no-scrollbar -mx-5 mt-5 flex gap-3 overflow-x-auto px-5 md:mx-0 md:px-0">
          {look.products.map((p, i) => (
            <div key={p.id} className="flex shrink-0 items-center gap-3">
              {i > 0 && <span className="text-xl text-steel">+</span>}
              <a href={`/p/${p.slug}`} className="block w-28">
                <Img urls={p.images[0]?.urls} alt={pick(p.nameEn, p.nameAm)} className="aspect-[4/5] w-28 rounded-xl object-cover" />
                <p className="mt-2 line-clamp-1 text-xs">{pick(p.nameEn, p.nameAm)}</p>
                <Price value={p.price} className="text-xs text-steel" />
              </a>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-steel">{t('look.together')}</p>
            <p className="font-mono text-xl">
              {birr(together)} <span className="ml-1 text-sm text-steel line-through">{birr(full)}</span>
            </p>
            <p className="text-xs text-ok">{t('look.save', { p: look.discountPercent })}</p>
          </div>
          <Button variant="accent" onClick={() => setOpen(look)}>
            {t('look.add')}
          </Button>
        </div>
      </div>
      {open && <LookSheet look={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function LookSheet({ look, onClose }: { look: Look; onClose: () => void }) {
  const { t, pick } = useT();
  const add = useCart((s) => s.add);
  const profile = useSizeProfile();
  const [chosen, setChosen] = useState<Record<string, string | null>>(() => {
    // Pre-pick: the only size, or the customer's remembered size when it's in stock
    const init: Record<string, string | null> = {};
    for (const p of look.products) {
      const inStock = p.variants.filter((v) => v.available > 0);
      const sizes = [...new Set(inStock.map((v) => v.size))];
      const mine = profile.sizes[p.category.slug];
      init[p.id] = sizes.length === 1 ? sizes[0]! : mine && sizes.includes(mine) ? mine : null;
    }
    return init;
  });
  const ready = look.products.every((p) => chosen[p.id] !== null && chosen[p.id] !== undefined);

  const addAll = () => {
    for (const p of look.products) {
      const v = p.variants.find((x) => x.size === chosen[p.id] && x.available > 0);
      if (!v) continue;
      add({ variantId: v.id, productId: p.id, slug: p.slug, name: p.nameEn, image: p.images[0]?.urls.sm ?? null, size: v.size, color: v.color, price: v.price, max: v.available });
    }
    haptic.success();
    toast.ok(t('look.added'));
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('look.pick')}
      footer={
        <Button variant="accent" size="lg" block disabled={!ready} onClick={addAll}>
          {t('look.add')}
        </Button>
      }
    >
      <div className="space-y-6">
        {look.products.map((p) => {
          const sizes = sortSizes([...new Set(p.variants.map((v) => v.size))]);
          const one = sizes.length === 1 && !sizes[0];
          return (
            <div key={p.id} className="flex gap-4">
              <Img urls={p.images[0]?.urls} alt="" className="aspect-[4/5] w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{pick(p.nameEn, p.nameAm)}</p>
                {!one && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sizes.map((s) => {
                      const ok = p.variants.some((v) => v.size === s && v.available > 0);
                      return (
                        <button
                          key={s}
                          disabled={!ok}
                          onClick={() => setChosen((c) => ({ ...c, [p.id]: s }))}
                          className={cn(
                            'h-9 min-w-10 rounded-lg border px-2 font-mono text-sm transition-colors disabled:opacity-25 disabled:line-through',
                            chosen[p.id] === s ? 'border-camel bg-camel text-ink' : 'border-seam text-steel hover:text-chalk',
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

// ─── Rewards card (My orders) ────────────────────────────

interface Rewards {
  loyalty: { percent: number } | null;
  credit: number;
  tier: { id: 'member' | 'gold' | 'vip'; name: string; spend: number; next: { id: string; name: string; at: number } | null };
  referral: {
    code: string;
    link: string;
    webLink: string;
    reward: number;
    friendDiscount: number;
    minSubtotal: number;
    friends: { joined: number; ordered: number; rewarded: number; earned: number; pending: number };
  } | null;
}

export function RewardsCard({ className }: { className?: string }) {
  const { t } = useT();
  const q = useQuery({ queryKey: ['rewards'], queryFn: () => api<Rewards>('/rewards') });
  const r = q.data;
  if (!r || (!r.loyalty && !r.referral && !r.credit)) return null;
  const progress = r.tier.next ? Math.min(100, (r.tier.spend / r.tier.next.at) * 100) : 100;
  const share = () => {
    if (!r.referral) return;
    const text = t('rw.shareMsg', { friend: birr(r.referral.friendDiscount) });
    openExternal(`https://t.me/share/url?url=${encodeURIComponent(r.referral.link)}&text=${encodeURIComponent(text)}`);
  };
  return (
    <div className={cn('overflow-hidden rounded-3xl border border-seam bg-[radial-gradient(130%_120%_at_100%_0%,rgba(185,139,87,0.16),transparent_55%)] p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label">{t('rw.credit')}</p>
          <p className="display mt-1 font-mono text-3xl">{birr(r.credit)}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider',
            r.tier.id === 'vip' ? 'bg-chalk text-ink' : r.tier.id === 'gold' ? 'bg-camel text-ink' : 'border border-seam text-steel',
          )}
        >
          <Crown className="size-3.5" /> {r.tier.name}
        </span>
      </div>
      {r.loyalty && (
        <>
          <p className="mt-3 text-sm text-steel">{t('rw.earn', { p: r.loyalty.percent })}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-seam">
            <div className="h-full rounded-full bg-camel" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-steel">
            {r.tier.next ? t('rw.next', { amount: birr(r.tier.next.at - r.tier.spend), tier: r.tier.next.name }) : t('rw.top')}
          </p>
        </>
      )}
      {r.referral && (
        <div className="mt-5 border-t border-seam/70 pt-5">
          <p className="text-sm font-medium">{t('rw.invite')}</p>
          <p className="mt-1 text-xs leading-relaxed text-steel">
            {t('rw.inviteText', { friend: birr(r.referral.friendDiscount), reward: birr(r.referral.reward) })}
          </p>
          {r.referral.friends.joined > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                [r.referral.friends.joined, t('rw.joined')],
                [r.referral.friends.ordered, t('rw.ordered')],
                [r.referral.friends.pending ? birr(r.referral.friends.pending) : birr(r.referral.friends.earned), r.referral.friends.pending ? t('rw.onTheWay') : t('rw.earned')],
              ].map(([v, l]) => (
                <div key={String(l)} className="rounded-xl bg-ink/40 px-2 py-2">
                  <p className="font-mono text-sm">{v}</p>
                  <p className="text-[0.65rem] text-steel">{l}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="accent" size="sm" onClick={share}>
              <Send className="size-4" /> {t('rw.share')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(r.referral!.webLink);
                toast.ok(t('rw.copied'));
              }}
            >
              <Copy className="size-4" /> <span className="font-mono">{r.referral.code}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Running campaign (shop banner) ──────────────────────

export function useCampaignBanner() {
  const { pick } = useT();
  const q = useCampaigns();
  const c = q.data?.find((x) => x.bannerEn || x.bannerAm);
  return c ? pick(c.bannerEn, c.bannerAm) : null;
}

// ─── Running campaigns on prices (before checkout) ───────

export interface CampaignInfo {
  id: string;
  name: string;
  type: 'PERCENT' | 'FIXED' | 'GIFT';
  value: number;
  giftText: string | null;
  minSubtotal: number;
  categorySlug: string | null;
  bannerEn: string | null;
  bannerAm: string | null;
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<{ campaigns: CampaignInfo[] }>('/promotions/active').then((r) => r.campaigns),
    staleTime: 5 * 60_000,
  });
}

/** A sale that lowers this category's price right away (percent off, no minimum). The server applies the same. */
export function useSalePercent(categorySlug: string | undefined) {
  const { data } = useCampaigns();
  if (!data || !categorySlug) return null;
  const best = data
    .filter((c) => c.type === 'PERCENT' && c.minSubtotal === 0 && (!c.categorySlug || c.categorySlug === categorySlug))
    .sort((a, b) => b.value - a.value)[0];
  return best ? { percent: best.value, name: best.name } : null;
}
export const salePrice = (price: number, percent: number) => price - Math.round((price * percent) / 100);

/** Offers with a condition (minimum order, fixed amount, free gift) — shown as a short note. */
export function useOfferNotes(categorySlug: string | undefined) {
  const { data } = useCampaigns();
  if (!data || !categorySlug) return [];
  return data
    .filter((c) => (!c.categorySlug || c.categorySlug === categorySlug) && !(c.type === 'PERCENT' && c.minSubtotal === 0))
    .map((c) => {
      const what = c.type === 'PERCENT' ? `−${c.value}%` : c.type === 'FIXED' ? `−${birr(c.value)}` : `🎁 ${c.giftText ?? ''}`;
      return { id: c.id, name: c.name, text: c.minSubtotal ? `${what} · ${birr(c.minSubtotal)}+` : what };
    });
}

/** Saves a friend's invite on the account as soon as the customer is signed in (works across devices). */
export function useAttachInvite() {
  const token = useCustomer((s) => s.token);
  useEffect(() => {
    const code = savedInviteCode();
    if (!token || !code) return;
    api<{ attached: boolean; reason?: string }>('/rewards/invite', { body: { code } })
      .then((r) => {
        if (r.attached || r.reason === 'already') forgetInviteCode();
      })
      .catch(() => undefined);
  }, [token]);
}
