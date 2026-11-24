import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { ProductGrid } from '../components/product/ProductCard';
import { TelegramLogin } from '../components/layout/TelegramLogin';
import { PageLoader, buttonClass } from '../components/ui';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import type { ProductCard } from '../lib/types';
import { useCustomer } from '../store/auth';
import { useWishlist } from '../store/wishlist';

/** Saved items (♡). Signed in so they follow the customer and price drops reach them on Telegram. */
export default function Saved() {
  const { t } = useT();
  const token = useCustomer((s) => s.token);
  const status = useCustomer((s) => s.status);
  const ids = useWishlist((s) => s.ids);
  const q = useQuery({
    queryKey: ['wishlist', token, ids.join(',')],
    queryFn: () => api<{ products: ProductCard[] }>('/wishlist').then((r) => r.products),
    enabled: Boolean(token),
  });

  if (status === 'loading') return <PageLoader />;
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8 md:pt-10">
      <h1 className="display text-[2rem]">{t('saved.title')}</h1>
      {!token ? (
        <div className="mx-auto max-w-md">
          <p className="mt-3 text-sm text-steel">{t('saved.signIn')}</p>
          <TelegramLogin />
        </div>
      ) : q.isLoading ? (
        <PageLoader />
      ) : !q.data?.length ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Heart className="size-10 text-seam" strokeWidth={1.4} />
          <p className="mt-4 max-w-xs text-sm text-steel">{t('saved.empty')}</p>
          <Link to="/shop" className={buttonClass('primary', 'md', 'mt-6')}>
            {t('bag.startShopping')}
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid products={q.data} />
        </div>
      )}
    </div>
  );
}
