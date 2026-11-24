import { Link, useNavigate } from 'react-router';
import { Minus, Plus, X } from 'lucide-react';
import { PrimaryAction } from '../components/layout/PrimaryAction';
import { Empty, Price, buttonClass } from '../components/ui';
import { useT } from '../lib/i18n';
import { birr } from '../lib/format';
import { haptic } from '../lib/telegram';
import { cartSubtotal, useCart } from '../store/cart';
import { DiscountRows, salePrice, useQuote, useSaleFor } from '../components/checkout/Offers';
import { Sparkles } from 'lucide-react';

export default function Bag() {
  const { t } = useT();
  const navigate = useNavigate();
  const { lines, setQty, remove } = useCart();
  const subtotal = cartSubtotal(lines);
  // Looks, running sales and a friend's invite — priced by the server, exactly as checkout will charge
  const quote = useQuote(lines, null, false);
  const priced = quote.data;
  const saleFor = useSaleFor();
  // Until the server confirms, never present the full price as the final total
  const confirming = !priced && quote.isFetching;
  const estimate = lines.reduce((n, l) => n + salePrice(l.price, saleFor(l.categorySlug)) * l.quantity, 0);
  const total = priced?.itemsTotal ?? estimate;
  const saved = priced ? priced.discountTotal : subtotal - estimate;

  if (!lines.length) {
    return (
      <Empty
        title={t('bag.empty')}
        action={
          <Link to="/shop" className={buttonClass('primary', 'md')}>
            {t('bag.startShopping')}
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:pt-10">
      <h1 className="display text-[2rem]">{t('bag.title')}</h1>
      {saved > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-ok/15 px-3.5 py-1.5 text-sm font-medium text-ok">
          <Sparkles className="size-4" /> {t('promo.saved', { n: birr(saved) })}
        </p>
      )}
      <ul className="mt-6 divide-y divide-seam border-y border-seam">
        {lines.map((l) => (
          <li key={l.variantId} className="flex gap-4 py-4">
            <Link to={`/p/${l.slug}`} className="w-24 shrink-0">
              {l.image ? (
                <img src={l.image} alt={l.name} className="aspect-[4/5] w-full rounded-md bg-wool object-cover" />
              ) : (
                <div className="aspect-[4/5] w-full rounded-md bg-wool" />
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/p/${l.slug}`} className="line-clamp-2 font-medium leading-snug">
                  {l.name}
                </Link>
                <button
                  onClick={() => {
                    haptic.tap();
                    remove(l.variantId);
                  }}
                  className="-mr-2 -mt-1 rounded-full p-2 text-steel hover:text-chalk"
                  aria-label={t('bag.remove')}
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="mt-1 font-mono text-xs text-steel">{[l.size, l.color].filter(Boolean).join(' · ')}</p>
              <div className="mt-auto flex items-center justify-between pt-3">
                <div className="flex items-center rounded-full border border-seam">
                  <button
                    onClick={() => setQty(l.variantId, l.quantity - 1)}
                    disabled={l.quantity <= 1}
                    className="grid size-9 place-items-center text-steel disabled:opacity-30"
                    aria-label="−"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono text-sm tabular-nums">{l.quantity}</span>
                  <button
                    onClick={() => setQty(l.variantId, l.quantity + 1)}
                    disabled={l.quantity >= (l.max || 20)}
                    className="grid size-9 place-items-center text-steel disabled:opacity-30"
                    aria-label="+"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                {(() => {
                  const pct = saleFor(l.categorySlug);
                  return <Price value={salePrice(l.price, pct) * l.quantity} compareAt={pct ? l.price * l.quantity : null} className="text-sm" />;
                })()}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-steel">{t('bag.subtotal')}</span>
          <Price value={subtotal} className={saved > 0 ? 'text-steel line-through decoration-1' : 'text-lg'} />
        </div>
        {confirming && (
          <div className="flex items-baseline justify-between text-steel">
            <span className="inline-flex items-center gap-2">
              <span className="size-3 animate-spin rounded-full border-2 border-camel border-t-transparent" /> {t('bag.applying')}
            </span>
            {estimate < subtotal && <Price value={estimate} className="text-lg text-chalk" />}
          </div>
        )}
        {priced && priced.discountTotal > 0 && (
          <>
            <DiscountRows discounts={priced.discounts} giftNote={priced.giftNote} />
            <div className="flex items-baseline justify-between border-t border-seam pt-2 text-base">
              <span>{t('bag.total')}</span>
              <span className="text-right">
                <Price value={total} className="text-lg" />
                <span className="block text-xs text-ok">{t('promo.saved', { n: birr(priced.discountTotal) })}</span>
              </span>
            </div>
          </>
        )}
        {priced?.giftNote && !priced.discountTotal && <DiscountRows discounts={[]} giftNote={priced.giftNote} />}
      </div>
      <p className="mt-1 text-right text-xs text-steel">{t('product.deliveryText')}</p>

      <PrimaryAction label={confirming && estimate === subtotal ? t('bag.continue') : `${t('bag.continue')} · ${birr(total)}`} onClick={() => navigate('/checkout')} />
    </div>
  );
}
