/**
 * Owner only: who runs the shop.
 *  • Team: owner + admins (ID check, remove).
 *  • Invite by phone or @username → they accept in Telegram → you tick "Make admin".
 *  • Add from people the shop already knows (customers, delivery people).
 * No passwords: admins sign in with Telegram.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Copy, Crown, Search, Send, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { Button } from '../../components/ui';
import { toast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/format';
import { adminApi, PageHeader } from '../ui';
import { FaydaIdentity } from './FaydaIdentity';
import { useIdentitySummary } from './Drivers';

interface Invite { id: string; contact: string; status: 'sent' | 'accepted' | 'declined'; name: string | null; username: string | null; createdAt: string; respondedAt: string | null; link: string }
interface Person { key: string; kind: 'owner' | 'admin' | 'driver' | 'customer'; name: string; phone: string | null; username: string | null; telegramId: string | null; staffId: string | null; active: boolean }

const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Failed');
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'customer', label: 'Customers' },
  { id: 'driver', label: 'Delivery' },
] as const;

function Avatar({ name, accent }: { name: string; accent?: boolean }) {
  return (
    <span className={cn('grid size-11 shrink-0 place-items-center rounded-full font-display text-base font-bold', accent ? 'bg-gradient-to-br from-camel to-camel-soft text-ink' : 'bg-gradient-to-br from-wool-2 to-ink text-chalk ring-1 ring-seam')}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function Staff() {
  const qc = useQueryClient();
  const [contact, setContact] = useState('');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [idOpen, setIdOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const ids = useIdentitySummary(true);
  const invites = useQuery({ queryKey: ['admin', 'staff', 'invites'], queryFn: () => adminApi<{ invites: Invite[] }>('/staff/invites').then((r) => r.invites), refetchInterval: 8000 });
  const everyone = useQuery({ queryKey: ['admin', 'staff', 'people', ''], queryFn: () => adminApi<{ people: Person[] }>('/staff/people', { query: { q: '' } }).then((r) => r.people) });
  const search = useQuery({
    queryKey: ['admin', 'staff', 'people', debounced],
    queryFn: () => adminApi<{ people: Person[] }>('/staff/people', { query: { q: debounced } }).then((r) => r.people),
    enabled: debounced.length > 0,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'staff'] });

  const invite = useMutation({
    mutationFn: () => adminApi<{ invite: { link: string; name: string | null }; delivered: boolean }>('/staff/invites', { body: { contact } }),
    onSuccess: (r) => {
      setContact('');
      refresh();
      if (r.delivered) toast.ok(`Sent to ${r.invite.name ?? 'them'} on Telegram`);
      else {
        void navigator.clipboard?.writeText(r.invite.link);
        toast.ok('Not on the bot yet — invite link copied, send it to them');
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const approve = useMutation({ mutationFn: (id: string) => adminApi(`/staff/invites/${id}/approve`, { body: {} }), onSuccess: () => (toast.ok('Admin added — they got a message on Telegram'), refresh()), onError: (e) => toast.error(errMsg(e)) });
  const cancel = useMutation({ mutationFn: (id: string) => adminApi(`/staff/invites/${id}`, { method: 'DELETE' }), onSuccess: refresh });
  const promote = useMutation({ mutationFn: (p: Person) => adminApi('/staff/promote', { body: { telegramId: p.telegramId, name: p.name } }), onSuccess: () => (toast.ok('Admin added — they got a message on Telegram'), refresh()), onError: (e) => toast.error(errMsg(e)) });
  const revoke = useMutation({ mutationFn: (id: string) => adminApi(`/staff/${id}`, { method: 'DELETE' }), onSuccess: () => (toast.ok('Admin access removed'), refresh()), onError: (e) => toast.error(errMsg(e)) });

  const team = (everyone.data ?? []).filter((p) => p.kind === 'owner' || p.kind === 'admin');
  const pending = invites.data ?? [];
  const pool = (debounced ? (search.data ?? []) : (everyone.data ?? [])).filter((p) => p.kind !== 'owner' && p.kind !== 'admin' && !p.staffId && (filter === 'all' || p.kind === filter));

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <PageHeader title="Admins" />

      {/* Team */}
      <section>
        <div className="mb-3 flex items-end justify-between px-1">
          <h2 className="label">Team · {team.length}</h2>
          <span className="text-xs text-steel">Sign in with Telegram — no passwords</span>
        </div>
        <div className="space-y-3">
          {team.map((p) => {
            const verified = p.staffId ? ids.data?.staff.includes(p.staffId) : false;
            const open = idOpen === p.staffId;
            return (
              <article key={p.key} className={cn('overflow-hidden rounded-3xl border bg-gradient-to-br from-wool-2/70 via-wool to-wool', p.kind === 'owner' ? 'border-camel/40' : 'border-seam/80', !p.active && 'opacity-60')}>
                <div className="flex items-center gap-4 p-4">
                  <Avatar name={p.name} accent={p.kind === 'owner'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-medium">{p.name}</p>
                      {verified && <ShieldCheck className="size-4 shrink-0 text-ok" aria-label="Fayda ID verified" />}
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-px', p.kind === 'owner' ? 'bg-camel text-ink' : 'bg-camel/15 text-camel')}>
                        {p.kind === 'owner' && <Crown className="size-3" />} {p.kind === 'owner' ? 'Owner' : 'Admin'}
                      </span>
                      {!p.active && <span className="rounded-full bg-danger/15 px-2 py-px text-danger">Off</span>}
                      <span className="truncate font-mono text-steel">{p.username ? `@${p.username}` : p.phone ?? ''}</span>
                    </p>
                  </div>
                </div>
                {p.staffId && (
                  <div className="flex items-center gap-1 border-t border-seam/50 px-2 py-1.5 text-[0.72rem] text-steel">
                    <button type="button" onClick={() => setIdOpen(open ? null : p.staffId)} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-ink/40 hover:text-chalk', open && 'text-camel')}>
                      <ShieldCheck className="size-3.5" /> {verified ? 'Fayda ID' : 'Verify Fayda ID'}
                      <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
                    </button>
                    {p.kind === 'admin' && (
                      <button
                        type="button"
                        onClick={() => window.confirm(`Remove admin access for ${p.name}? They’re told on Telegram.`) && revoke.mutate(p.staffId!)}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" /> Remove
                      </button>
                    )}
                  </div>
                )}
                {open && p.staffId && (
                  <div className="border-t border-seam/50 p-3">
                    <FaydaIdentity subject={{ type: 'staff', id: p.staffId, name: p.name }} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Invite */}
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2AABEE]/30 bg-gradient-to-br from-[#2AABEE]/[0.12] via-wool to-wool p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-[#2AABEE]/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[#2AABEE] text-white">
            <Send className="size-5" />
          </span>
          <div>
            <h2 className="font-medium">Invite an admin</h2>
            <p className="text-xs text-steel">They accept in Telegram, then you confirm here.</p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (contact.trim().length >= 3) invite.mutate();
          }}
          className="relative mt-4 flex gap-2"
        >
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone (09…) or @username"
            className="h-12 min-w-0 flex-1 rounded-full border border-seam bg-ink/60 px-4 text-sm placeholder:text-steel focus:border-[#2AABEE] focus:outline-none"
          />
          <button type="submit" disabled={contact.trim().length < 3 || invite.isPending} className="h-12 shrink-0 rounded-full bg-[#2AABEE] px-5 text-sm font-semibold text-white disabled:opacity-50">
            {invite.isPending ? 'Sending…' : 'Invite'}
          </button>
        </form>

        {pending.length > 0 && (
          <ul className="relative mt-4 space-y-2">
            {pending.map((i) => (
              <li key={i.id} className={cn('flex items-center gap-3 rounded-2xl border p-3', i.status === 'accepted' ? 'border-ok/40 bg-ok/[0.06]' : 'border-seam/60 bg-ink/40')}>
                <Avatar name={i.name ?? i.contact.replace('@', '')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {i.name ?? i.contact}
                    {i.username && <span className="ml-1 text-steel">@{i.username}</span>}
                  </span>
                  <span className={cn('block text-xs', i.status === 'accepted' ? 'text-ok' : i.status === 'declined' ? 'text-danger' : 'text-steel')}>
                    {i.status === 'accepted' ? `Accepted ${i.respondedAt ? formatDateTime(i.respondedAt) : ''}` : i.status === 'declined' ? 'Declined' : 'Waiting for them to accept…'}
                  </span>
                </span>
                {i.status === 'accepted' ? (
                  <Button size="sm" variant="accent" loading={approve.isPending && approve.variables === i.id} onClick={() => approve.mutate(i.id)}>
                    <Check className="size-4" /> Make admin
                  </Button>
                ) : i.status === 'sent' ? (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(i.link);
                      toast.ok('Invite link copied');
                    }}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-seam text-steel hover:text-chalk"
                    aria-label="Copy invite link"
                  >
                    <Copy className="size-4" />
                  </button>
                ) : null}
                <button type="button" onClick={() => cancel.mutate(i.id)} className="inline-flex size-9 items-center justify-center rounded-full text-steel hover:text-danger" aria-label="Cancel invite">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* From people the shop knows */}
      <section>
        <h2 className="label mb-3 px-1">Add from people the shop knows</h2>
        <div className="rounded-3xl border border-seam/80 bg-wool p-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-steel" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or @username" className="h-12 w-full rounded-full border border-seam bg-ink/50 pl-11 pr-4 text-sm focus:border-camel focus:outline-none" />
          </label>
          <div className="mt-3 flex gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={cn('h-8 rounded-full px-3.5 text-xs transition-colors', filter === f.id ? 'bg-chalk text-ink' : 'text-steel hover:text-chalk')}>
                {f.label}
              </button>
            ))}
          </div>
          <ul className="mt-2 divide-y divide-seam/50">
            {pool.slice(0, 25).map((p) => (
              <li key={p.key} className="flex items-center gap-3 py-3">
                <Avatar name={p.name} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm">{p.name}</span>
                    <span className="shrink-0 rounded-full bg-wool-2 px-2 py-px text-[0.62rem] text-steel">{p.kind === 'driver' ? 'Delivery' : 'Customer'}</span>
                  </span>
                  <span className="block truncate font-mono text-xs text-steel">{[p.username && `@${p.username}`, p.phone].filter(Boolean).join(' · ') || 'Telegram'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => window.confirm(`Make ${p.name} an admin? They can see orders, customers and products.`) && promote.mutate(p)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-camel/40 px-3 text-xs text-camel hover:bg-camel/10"
                >
                  <UserPlus className="size-3.5" /> Make admin
                </button>
              </li>
            ))}
            {!pool.length && <li className="py-6 text-center text-sm text-steel">{debounced ? 'Nobody found.' : 'No one here yet.'}</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
