/**
 * Owner: backups (daily to Telegram, encrypted) and storage (what uses space, safe cleanup).
 * Nothing here deletes data without a fresh backup first.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Database, HardDrive, Images, LoaderCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, ErrorState, PageLoader } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/format';
import { adminApi, Card, PageHeader } from '../ui';

interface Run { id: string; kind: 'db' | 'files' | 'cleanup'; status: 'running' | 'ok' | 'failed'; trigger: string; startedAt: string; finishedAt: string | null; rows: number; files: number; bytes: number; parts: number; note: string | null }
interface Status {
  ready: boolean;
  reason: string | null;
  chatConnected: boolean;
  lastDb: Run | null;
  lastOkAt: string | null;
  files: { backedUp: number; total: number; bytes: number };
  runs: Run[];
}
interface Storage {
  database: { bytes: number; tables: { name: string; bytes: number; rows: number }[] };
  storage: { files: number; bytes: number; folders: Record<string, { files: number; bytes: number }> };
  orphans: { files: number; bytes: number };
}
interface Preview {
  records: { id: string; label: string; rows: number }[];
  orphanFiles: { files: number; bytes: number; sample: string[] };
  backupFresh: boolean;
  lastBackupAt: string | null;
}

const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};
const FOLDER: Record<string, string> = { products: 'Product photos', originals: 'Original-product photos', proofs: 'Payment screenshots', reviews: 'Review photos', site: 'Home page media' };
const RUN_LABEL = { db: 'Database', files: 'Files', cleanup: 'Cleanup' };

export default function Backups() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['admin', 'backups'], queryFn: () => adminApi<Status>('/backups'), refetchInterval: (q) => (q.state.data?.runs.some((r) => r.status === 'running') ? 3000 : false) });
  const storage = useQuery({ queryKey: ['admin', 'storage'], queryFn: () => adminApi<Storage>('/storage') });
  const preview = useQuery({ queryKey: ['admin', 'storage', 'cleanup'], queryFn: () => adminApi<Preview>('/storage/cleanup') });
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'backups'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'storage'] });
  };
  const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Failed');

  const backup = useMutation({
    mutationFn: () => adminApi<{ run: Run }>('/backups/run', { body: {} }),
    onMutate: () => setBusy('db'),
    onSuccess: (r) => toast.ok(`Backed up ${r.run.rows.toLocaleString()} rows to your Telegram`),
    onError: err,
    onSettled: () => (setBusy(null), refresh()),
  });
  const files = useMutation({
    mutationFn: () => adminApi<{ copied: number }>('/backups/files', { body: {} }),
    onMutate: () => setBusy('files'),
    onSuccess: (r) => toast.ok(r.copied ? `Copied ${r.copied} files` : 'Nothing new to copy'),
    onError: err,
    onSettled: () => (setBusy(null), refresh()),
  });
  const clean = useMutation({
    mutationFn: () => adminApi<{ removed: Record<string, number>; files: number }>('/storage/cleanup', { body: {} }),
    onMutate: () => setBusy('clean'),
    onSuccess: (r) => toast.ok(`Cleaned ${Object.values(r.removed).reduce((a, b) => a + b, 0)} records and ${r.files} files`),
    onError: err,
    onSettled: () => (setBusy(null), refresh()),
  });

  if (status.isLoading) return <PageLoader />;
  if (status.error || !status.data) return <ErrorState message="Couldn’t load backups." onRetry={() => status.refetch()} />;
  const s = status.data;
  const stale = !s.lastOkAt || Date.now() - new Date(s.lastOkAt).getTime() > 26 * 3600_000;
  const filesPct = s.files.total ? Math.round((s.files.backedUp / s.files.total) * 100) : 100;
  const p = preview.data;
  const cleanable = (p?.records.reduce((n, r) => n + r.rows, 0) ?? 0) + (p?.orphanFiles.files ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <PageHeader title="Backups & storage" />

      {/* Health */}
      <div className={cn('flex items-start gap-3 rounded-2xl border p-4', !s.ready || !s.chatConnected ? 'border-danger/40 bg-danger/[0.06]' : stale ? 'border-camel/40 bg-camel/[0.06]' : 'border-ok/30 bg-ok/[0.05]')}>
        {!s.ready || !s.chatConnected ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" /> : stale ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-camel" /> : <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" />}
        <div className="text-sm">
          {!s.ready ? (
            <p>{s.reason}</p>
          ) : !s.chatConnected ? (
            <p>Connect your Telegram (Settings → Telegram → You) — backups are sent to you there, privately.</p>
          ) : (
            <>
              <p className="font-medium">{s.lastOkAt ? `Last database backup ${ago(s.lastOkAt)}` : 'No database backup yet'}</p>
              <p className="text-steel">A new one goes to your Telegram every day after 03:00. Files are copied as they’re added. Everything is encrypted with your BACKUP_KEY.</p>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-seam/80 bg-wool p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Database className="size-4 text-camel" /> Database
          </p>
          <p className="mt-1 text-xs text-steel">Orders, customers, products, stock — one consistent moment.</p>
          <Button variant="accent" block className="mt-3" loading={busy === 'db'} disabled={!s.ready || !s.chatConnected || !!busy} onClick={() => backup.mutate()}>
            Back up now
          </Button>
        </div>
        <div className="rounded-2xl border border-seam/80 bg-wool p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Images className="size-4 text-camel" /> Photos & files · {s.files.backedUp}/{s.files.total}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wool-2">
            <div className="h-full rounded-full bg-camel transition-[width]" style={{ width: `${filesPct}%` }} />
          </div>
          <p className="mt-1 text-xs text-steel">{filesPct === 100 ? 'All copied.' : 'Copying in the background, about 20 every 5 minutes.'}</p>
          <Button variant="outline" block className="mt-3" loading={busy === 'files'} disabled={!s.ready || !s.chatConnected || !!busy || filesPct === 100} onClick={() => files.mutate()}>
            Copy more now
          </Button>
        </div>
      </div>

      {/* History */}
      {s.runs.length > 0 && (
        <Card title="Recent">
          <ul className="divide-y divide-seam/60">
            {s.runs.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                {r.status === 'running' ? <LoaderCircle className="size-4 animate-spin text-camel" /> : r.status === 'ok' ? <CheckCircle2 className="size-4 text-ok" /> : <CircleAlert className="size-4 text-danger" />}
                <span className="flex-1">
                  {RUN_LABEL[r.kind]} <span className="text-steel">· {r.trigger}</span>
                  {r.status === 'failed' && r.note && <span className="block text-xs text-danger">{r.note}</span>}
                </span>
                <span className="text-right text-xs text-steel">
                  {r.kind === 'db' && r.status === 'ok' && `${r.rows.toLocaleString()} rows · ${mb(r.bytes)}${r.parts > 1 ? ` · ${r.parts} parts` : ''}`}
                  {r.kind !== 'db' && r.status === 'ok' && `${r.files} files${r.rows ? ` · ${r.rows} records` : ''}`}
                  <span className="block">{formatDateTime(r.startedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Storage */}
      {storage.data && (
        <Card title="What uses space">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-sm">
                <Database className="size-4 text-steel" /> Database · <b className="font-mono">{mb(storage.data.database.bytes)}</b>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-steel">
                {storage.data.database.tables.slice(0, 6).map((t) => (
                  <li key={t.name} className="flex justify-between gap-3">
                    <span>{t.name}</span>
                    <span className="font-mono">
                      {t.rows.toLocaleString()} · {mb(t.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm">
                <HardDrive className="size-4 text-steel" /> Files · <b className="font-mono">{mb(storage.data.storage.bytes)}</b>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-steel">
                {Object.entries(storage.data.storage.folders)
                  .sort((a, b) => b[1].bytes - a[1].bytes)
                  .map(([f, v]) => (
                    <li key={f} className="flex justify-between gap-3">
                      <span>{FOLDER[f] ?? f}</span>
                      <span className="font-mono">
                        {v.files.toLocaleString()} · {mb(v.bytes)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Cleanup */}
      {p && (
        <Card title="Free up space">
          <ul className="space-y-1.5 text-sm">
            {p.records.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className={cn(!r.rows && 'text-steel')}>{r.label}</span>
                <span className="font-mono text-steel">{r.rows}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3">
              <span className={cn(!p.orphanFiles.files && 'text-steel')}>Files nothing uses any more (replaced or deleted photos)</span>
              <span className="font-mono text-steel">
                {p.orphanFiles.files} · {mb(p.orphanFiles.bytes)}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-steel">Never touched: orders, payments, stock history, customers, products, reviews. Removed files are copied to your Telegram first.</p>
          <Button
            variant="outline"
            className="mt-4"
            loading={busy === 'clean'}
            disabled={!cleanable || !p.backupFresh || !!busy}
            onClick={() => window.confirm(`Remove ${cleanable} old records/files? Everything is in today’s backup.`) && clean.mutate()}
          >
            <Trash2 className="size-4" /> Clean up {cleanable ? `(${cleanable})` : ''}
          </Button>
          {!p.backupFresh && cleanable > 0 && <p className="mt-2 text-xs text-camel">Back up the database first — cleanup only runs right after a fresh backup.</p>}
        </Card>
      )}

      <details className="rounded-2xl border border-seam/80 bg-wool p-4 text-sm">
        <summary className="cursor-pointer font-medium">How a restore works</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-steel">
          <li>In Telegram, download the backup file(s) of the day you want (all parts).</li>
          <li>On a computer with the project: an empty database with the same app version, an env file with its DATABASE_URL and your BACKUP_KEY.</li>
          <li>
            <code className="text-chalk">npm run backup:restore -- db &lt;files&gt; --dry-run</code> checks everything without writing; then run it without <code>--dry-run</code>.
          </li>
          <li>
            <code className="text-chalk">npm run backup:restore -- files</code> puts every photo back at its original place.
          </li>
          <li>Rows keep their ids and dates; the restore is all-or-nothing.</li>
        </ol>
      </details>
    </div>
  );
}
