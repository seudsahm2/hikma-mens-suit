import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Languages, Snail, TrendingUp } from 'lucide-react';
import { PageLoader } from '../../components/ui';
import { birr, cn } from '../../lib/format';
import { adminApi, Card, PageHeader } from '../ui';

interface Data {
  days: number;
  stock: { pieces: number; retail: number; cost: number; products: number };
  slow: { id: string; name: string; image: string | null; stock: number; value: number; daysListed: number }[];
  reorder: { productId: string; name: string; size: string; color: string; stock: number; soldLast30: number; daysLeft: number | null }[];
  sizes: { category: string; slug: string; total: number; sizes: { size: string; qty: number }[] }[];
  missingAmharic: number;
}

/** What's selling, what isn't, what to reorder. */
export default function Insights() {
  const [days, setDays] = useState(60);
  const q = useQuery({ queryKey: ['admin', 'insights', days], queryFn: () => adminApi<Data>('/insights', { query: { days } }) });
  const d = q.data;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Insights"
        kicker="Stock & sizes"
        action={
          <div className="flex rounded-full border border-seam p-1">
            {[30, 60, 90].map((n) => (
              <button key={n} onClick={() => setDays(n)} className={cn('h-8 rounded-full px-3.5 text-sm', days === n ? 'bg-chalk text-ink' : 'text-steel')}>
                {n} days
              </button>
            ))}
          </div>
        }
      />
      {!d ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Pieces in stock', d.stock.pieces.toLocaleString('en-US')],
              ['Stock at sale price', birr(d.stock.retail)],
              ['Stock at cost', d.stock.cost ? birr(d.stock.cost) : '— (add costs)'],
              ['Products on sale', String(d.stock.products)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-seam/80 bg-wool p-4">
                <p className="label">{l}</p>
                <p className="mt-1 font-mono text-lg">{v}</p>
              </div>
            ))}
          </div>

          <Card title="Reorder soon" action={<AlertTriangle className="size-4 text-camel" />}>
            {!d.reorder.length ? (
              <p className="text-sm text-steel">Nothing is about to run out at the current pace.</p>
            ) : (
              <ul className="divide-y divide-seam/60">
                {d.reorder.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                    <Link to={`/admin/products/${r.productId}`} className="min-w-0 flex-1 truncate hover:text-camel">
                      {r.name} <span className="font-mono text-steel">{[r.size, r.color].filter(Boolean).join(' · ')}</span>
                    </Link>
                    <span className="font-mono text-xs text-steel">{r.soldLast30} sold / 30d</span>
                    <span className={cn('w-28 text-right font-mono text-xs', (r.daysLeft ?? 99) <= 7 ? 'text-danger' : 'text-camel')}>
                      {r.stock === 0 ? 'Sold out' : `${r.stock} left · ~${r.daysLeft}d`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Best-selling sizes · last ${d.days} days`} action={<TrendingUp className="size-4 text-ok" />}>
            {!d.sizes.length ? (
              <p className="text-sm text-steel">No sales with sizes yet.</p>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {d.sizes.map((c) => {
                  const max = Math.max(...c.sizes.map((s) => s.qty));
                  return (
                    <div key={c.slug}>
                      <p className="mb-2 text-sm">
                        {c.category} <span className="text-xs text-steel">· {c.total} sold</span>
                      </p>
                      <div className="flex h-24 items-end gap-1.5">
                        {c.sizes.map((s) => (
                          <div key={s.size} className="flex flex-1 flex-col items-center gap-1">
                            <span className="font-mono text-[0.65rem] text-steel">{s.qty}</span>
                            <div className={cn('w-full rounded-t', s.qty === max ? 'bg-camel' : 'bg-seam')} style={{ height: `${Math.max(6, (s.qty / max) * 64)}px` }} />
                            <span className="font-mono text-[0.7rem]">{s.size}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title={`Not selling · nothing sold in ${d.days} days`} action={<Snail className="size-4 text-steel" />}>
            {!d.slow.length ? (
              <p className="text-sm text-steel">Everything in stock sold at least once. 👌</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {d.slow.map((p) => (
                    <Link key={p.id} to={`/admin/products/${p.id}`} className="overflow-hidden rounded-xl border border-seam/80 hover:border-steel">
                      {p.image ? <img src={p.image} alt="" className="aspect-[4/5] w-full object-cover" /> : <div className="aspect-[4/5] bg-wool-2" />}
                      <div className="p-2.5">
                        <p className="truncate text-xs">{p.name}</p>
                        <p className="font-mono text-[0.7rem] text-steel">
                          {p.stock} pcs · {birr(p.value)} · {p.daysListed}d
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
                <p className="mt-3 text-xs text-steel">Ideas: put them in a “Complete the look”, run an offer for that category, or post them again on the channel.</p>
              </>
            )}
          </Card>

          {d.missingAmharic > 0 && (
            <p className="flex items-center gap-2 text-sm text-steel">
              <Languages className="size-4 text-camel" /> {d.missingAmharic} products have no Amharic name — open one and use “✨ Suggest Amharic” under More details.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
