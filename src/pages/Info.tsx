import { Link, useParams } from 'react-router';
import { Empty, PageLoader, buttonClass } from '../components/ui';
import { useConfig } from '../hooks/queries';
import { useT } from '../lib/i18n';

export function InfoPage() {
  const { slug } = useParams();
  const { t, pick } = useT();
  const { data, isLoading } = useConfig();
  if (isLoading || !data) return <PageLoader />;
  const s = data.store;

  if (slug === 'returns') {
    return (
      <article className="mx-auto max-w-2xl px-4 pt-6 md:pt-10">
        <h1 className="display text-[1.8rem]">{t('info.returns')}</h1>
        <p className="mt-6 whitespace-pre-line leading-relaxed text-chalk/85">{pick(s.returnPolicyEn, s.returnPolicyAm)}</p>
        <div className="mt-10 space-y-1 border-t border-seam pt-6 text-sm text-steel">
          <p>{pick(s.addressEn, s.addressAm)}</p>
          <p className="font-mono">{s.phone}</p>
        </div>
      </article>
    );
  }
  return <NotFound />;
}

export function NotFound() {
  const { t } = useT();
  return (
    <Empty
      title="404"
      action={
        <Link to="/" className={buttonClass('primary')}>
          {t('nav.home')}
        </Link>
      }
    />
  );
}
